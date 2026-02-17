import numpy as np
from collections import deque
import time

class GestureEngine:
    def __init__(self):
        self.history = deque(maxlen=15)
        
        # --- STRICTER Thresholds ---
        self.min_swipe_dist = 0.18        # Need BIGGER movement
        self.min_dx_swipe = 0.10          # Stronger horizontal minimum
        self.brightness_threshold = 0.08  # 60% higher (48px minimum)
        self.min_vert_bias = 8.0          # 8x vertical bias (was 5x)
        
        # Pinch/Zoom
        self.pinch_start_threshold = 0.04
        self.zoom_cooldown = 0.3
        self.last_zoom_time = 0

        # States
        self.state = "IDLE"
        self.palm_start_time = None
        self.arm_duration = 0.8
        self.cooldown_time = 1.0          # Longer cooldown
        self.last_action_time = time.time()

    def is_open_palm(self, landmarks):
        tips = [8, 12, 16, 20]; pips = [6, 10, 14, 18]
        extended = sum(1 for t, p in zip(tips, pips) if landmarks[t][1] < landmarks[p][1])
        return extended >= 4 

    def update(self, landmarks):
        current_time = time.time()

        if landmarks is None:
            self.state = "IDLE"
            self.history.clear()
            return None

        curr_p = np.array(landmarks[8][:2])
        self.history.append(curr_p)
        
        if len(self.history) < 12:  # Need more stable history
            return None

        if self.state == "IDLE":
            if self.is_open_palm(landmarks):
                if self.palm_start_time is None:
                    self.palm_start_time = current_time
                elif current_time - self.palm_start_time >= self.arm_duration:
                    self.state = "ARMED"
                    self.history.clear()
                    print("--- SYSTEM ARMED ---")
            else:
                self.palm_start_time = None
            return None

        if self.state == "COOLDOWN":
            if current_time - self.last_action_time >= self.cooldown_time:
                self.state = "IDLE"
            return None

        if self.state == "ARMED":
            points = np.array(self.history)
            n = len(points)
            start_avg = np.mean(points[:n//2], axis=0)
            end_avg = np.mean(points[n//2:], axis=0)
            diff = end_avg - start_avg
            dx, dy = diff
            dist = np.linalg.norm(diff)
            
            # LESS VERBOSE DEBUG (only bigger moves)
            if dist > 0.05:
                print(f"dx:{dx:.3f} dy:{dy:.3f} dist:{dist:.3f} (~{dist*640:.0f}px)")
            
            # 1. PINCH ZOOM
            recent_points = np.array(list(self.history)[-5:])
            thumb_tip = np.array(landmarks[4][:2])
            thumb_tip_expanded = thumb_tip[None, :]
            pinch_dists = np.linalg.norm(recent_points - thumb_tip_expanded, axis=1)
            avg_pinch_dist = np.mean(pinch_dists)
            if avg_pinch_dist < self.pinch_start_threshold and abs(dy) > 0.04:
                if current_time - self.last_zoom_time > self.zoom_cooldown:
                    self.last_zoom_time = current_time
                    direction = "IN" if dy > 0 else "OUT"
                    print(f"Pinch+Move: ZOOM {direction}")
                    self._trigger_action()
                    return f"ZOOM {direction}"

            # 2. SWIPE (proven working - keep strict)
            horiz_ratio = abs(dx) / (abs(dy) + 1e-6)
            if (horiz_ratio > 6.0 and          # Even stricter horizontal bias
                dist > self.min_swipe_dist and
                abs(dx) > self.min_dx_swipe):
                self._trigger_action()
                dir_str = "RIGHT" if dx > 0 else "LEFT"
                print(f"✅ SWIPE {dir_str} (ratio:{horiz_ratio:.1f}x)")
                return f"SWIPE {dir_str}"

            # 3. BRIGHTNESS (MUCH stricter - only PURE vertical)
            vert_ratio = abs(dy) / (abs(dx) + 1e-6)
            if (vert_ratio > self.min_vert_bias and     # 8x vertical bias
                abs(dy) > self.brightness_threshold and # Much higher threshold
                dist > 0.12):                            # Needs sustained movement
                print(f"📈 BRIGHTNESS dy={dy:.3f} (ratio:{vert_ratio:.1f}x)")
                return ("BRIGHTNESS", dy)

        return None

    def _trigger_action(self):
        self.state = "COOLDOWN"
        self.last_action_time = time.time()
        print("🔥 ACTION TRIGGERED (1s cooldown)")
