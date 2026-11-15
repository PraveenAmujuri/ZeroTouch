"""
ZeroTouch HUD & Diagnostic UI Renderer
Renders medical styling, operating mode indicators, two-hand posture status,
finger counts, interaction lifecycle state, and diagnostic overlay.
"""

import cv2
import numpy as np
from typing import Dict, Any, Optional
from core.config import UIConfig, config


class UIRenderer:
    """
    Renders clean, clinical visual feedback for two-hand interaction:
    - Selected Operating Mode (SLICE_NAVIGATION, ZOOM, WINDOWING, PANNING)
    - Interaction Lifecycle State (READY, MODE_SELECTION, ACTION, NEUTRAL)
    - Left/Right hand finger counts and postures
    - Active Viewing Window preset badge
    - Action confirmation banners
    - Diagnostic Debug HUD toggled with 'D' key
    """

    def __init__(self, ui_config: Optional[UIConfig] = None):
        self.cfg = ui_config or config.ui
        self.debug_mode = self.cfg.show_debug_overlay
        self.banner_text: str = ""
        self.banner_color = (0, 255, 0)
        self.banner_timer: int = 0

    def trigger_banner(self, text: str, color=(0, 255, 255), frames: int = 25):
        self.banner_text = text
        self.banner_color = color
        self.banner_timer = frames

    def toggle_debug(self):
        self.debug_mode = not self.debug_mode

    @staticmethod
    def draw_glass_card(img: np.ndarray, x: int, y: int, w: int, h: int, alpha: float = 0.65, color=(24, 24, 28)):
        sub_img = img[y:y + h, x:x + w]
        rect = np.full(sub_img.shape, color, dtype=np.uint8)
        blended = cv2.addWeighted(sub_img, 1.0 - alpha, rect, alpha, 0)
        img[y:y + h, x:x + w] = blended
        cv2.rectangle(img, (x, y), (x + w, y + h), (60, 60, 70), 1)

    def draw_progress_bar(self, img: np.ndarray, x: int, y: int, w: int, h: int, progress: float, color=(0, 255, 0)):
        cv2.rectangle(img, (x, y), (x + w, y + h), (80, 80, 80), 1)
        fill_w = int(w * np.clip(progress, 0.0, 1.0))
        if fill_w > 0:
            cv2.rectangle(img, (x + 1, y + 1), (x + fill_w - 1, y + h - 1), color, -1)

    def render_camera_overlay(
        self,
        frame: np.ndarray,
        mode_str: str,
        pose_str: str,
        left_posture: str,
        right_posture: str,
        left_count: int,
        right_count: int,
        interaction_state: str,
        debug_info: Dict[str, Any],
        fps: float
    ) -> np.ndarray:
        """Draws the two-hand interaction HUD over the camera feed."""
        h, w = frame.shape[:2]

        # 1. Top Mode Selector Badge
        self.draw_glass_card(frame, 15, 15, 450, 90, alpha=0.7)

        cv2.putText(frame, "OPERATING MODE:", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 200), 1)
        cv2.putText(frame, mode_str, (30, 68), cv2.FONT_HERSHEY_DUPLEX, 0.72, (0, 255, 180), 2)

        # Interaction Lifecycle State Badge
        state_color = (0, 255, 100) if interaction_state == "READY" else (
            (0, 220, 255) if interaction_state == "MODE_SELECTION" else (
                (255, 180, 0) if interaction_state == "ACTION" else (160, 160, 160)
            )
        )
        cv2.putText(frame, f"[{interaction_state}]", (320, 40), cv2.FONT_HERSHEY_DUPLEX, 0.55, state_color, 1)

        # Subtle instruction
        if mode_str == "PANNING":
            sub = "Panning: 1+1 Left | 2+2 Right | 3+3 Up | 4+4 Down | Neutral: Stop"
        else:
            sub = "Matching Fingers (1..4): Select Mode | H+F: Act | Neutral: Stop"
        cv2.putText(frame, sub, (30, 92), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (170, 170, 170), 1)

        # 2. Hand Posture & Finger Count Indicators (Left and Right hands at chest level)
        card_w = 205
        # Left Hand Box
        self.draw_glass_card(frame, 15, h - 90, card_w, 75, alpha=0.7)
        cv2.putText(frame, f"LEFT HAND ({left_count} Fg)", (25, h - 68), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 180, 180), 1)
        lp_color = (0, 255, 100) if left_posture == "HAND" else ((0, 165, 255) if left_posture == "FIST" else (200, 200, 0))
        cv2.putText(frame, f"{left_posture} ({left_count})", (25, h - 35), cv2.FONT_HERSHEY_DUPLEX, 0.65, lp_color, 2)

        # Right Hand Box
        self.draw_glass_card(frame, w - card_w - 15, h - 90, card_w, 75, alpha=0.7)
        cv2.putText(frame, f"RIGHT HAND ({right_count} Fg)", (w - card_w + 10, h - 68), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 180, 180), 1)
        rp_color = (0, 255, 100) if right_posture == "HAND" else ((0, 165, 255) if right_posture == "FIST" else (200, 200, 0))
        cv2.putText(frame, f"{right_posture} ({right_count})", (w - card_w + 10, h - 35), cv2.FONT_HERSHEY_DUPLEX, 0.65, rp_color, 2)

        # Center Active Pose Badge
        center_w = 195
        cx = (w - center_w) // 2
        self.draw_glass_card(frame, cx, h - 90, center_w, 75, alpha=0.75)
        cv2.putText(frame, "CURRENT POSE", (cx + 10, h - 68), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 180, 180), 1)
        pose_display = f"{left_count}+{right_count}" if pose_str == "MATCHING_COUNTS" else pose_str[:14]
        cv2.putText(frame, pose_display, (cx + 10, h - 35), cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 220, 0), 2)

        # 3. Action Pulse Banner
        if self.banner_timer > 0:
            self.banner_timer -= 1
            banner_box_w = 460
            bx = (w - banner_box_w) // 2
            self.draw_glass_card(frame, bx, h // 2 - 35, banner_box_w, 60, alpha=0.85, color=(10, 40, 15))
            cv2.rectangle(frame, (bx, h // 2 - 35), (bx + banner_box_w, h // 2 + 25), self.banner_color, 2)
            cv2.putText(frame, self.banner_text, (bx + 20, h // 2 + 6),
                        cv2.FONT_HERSHEY_DUPLEX, 0.72, self.banner_color, 2)

        # 4. Diagnostics Overlay (Toggled with 'D' key)
        if self.debug_mode:
            dbg_w, dbg_h = 260, 175
            dbg_x = w - dbg_w - 15
            self.draw_glass_card(frame, dbg_x, 15, dbg_w, dbg_h, alpha=0.85)
            cv2.putText(frame, "DIAGNOSTICS [D: Toggle]", (dbg_x + 10, 32),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 220, 255), 1)
            cv2.putText(frame, f"FPS: {fps:.1f}", (dbg_x + 10, 52),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (220, 220, 220), 1)
            cv2.putText(frame, f"Hands Tracked: {debug_info.get('hands_count', 0)} ({debug_info.get('tracking_status', 'N/A')})",
                        (dbg_x + 10, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 220, 220), 1)
            cv2.putText(frame, f"Left:  {debug_info.get('left_posture', 'N/A')} (Fingers: {debug_info.get('left_count', 0)})",
                        (dbg_x + 10, 92), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 220, 220), 1)
            cv2.putText(frame, f"Right: {debug_info.get('right_posture', 'N/A')} (Fingers: {debug_info.get('right_count', 0)})",
                        (dbg_x + 10, 112), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 220, 220), 1)
            cv2.putText(frame, f"Lifecycle: {debug_info.get('state', 'N/A')}",
                        (dbg_x + 10, 132), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0, 255, 180), 1)
            cv2.putText(frame, f"Active Action: {debug_info.get('active_action', 'NONE')}",
                        (dbg_x + 10, 152), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (255, 220, 0), 1)

        return frame

    def render_dicom_overlay(
        self,
        dicom_frame: np.ndarray,
        slice_idx: int,
        total_slices: int,
        zoom_scale: float,
        window_center: float,
        window_width: float,
        pan_x: float,
        pan_y: float,
        preset_name: str,
        last_action_str: str
    ) -> np.ndarray:
        """Renders medical telemetry onto DICOM display."""
        if len(dicom_frame.shape) == 2:
            display = cv2.cvtColor(dicom_frame, cv2.COLOR_GRAY2BGR)
        else:
            display = dicom_frame.copy()

        h, w = display.shape[:2]

        # Top-Left Telemetry Card
        self.draw_glass_card(display, 15, 15, 290, 145, alpha=0.65)
        cv2.putText(display, f"VIEWPORT: {preset_name}", (25, 38),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1)
        cv2.putText(display, f"Slice: {slice_idx + 1} / {total_slices}", (25, 65),
                    cv2.FONT_HERSHEY_DUPLEX, 0.65, (255, 255, 255), 1)
        cv2.putText(display, f"Zoom:  {zoom_scale:.2f}x", (25, 92),
                    cv2.FONT_HERSHEY_DUPLEX, 0.65, (255, 255, 255), 1)
        cv2.putText(display, f"WC/WW: {int(window_center)} / {int(window_width)}", (25, 118),
                    cv2.FONT_HERSHEY_DUPLEX, 0.58, (255, 255, 255), 1)
        cv2.putText(display, f"Pan:   ({int(pan_x)}, {int(pan_y)}) px", (25, 142),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (200, 200, 200), 1)

        # Slice progress bar
        if total_slices > 1:
            bar_w = w - 40
            slice_ratio = slice_idx / max(total_slices - 1, 1)
            self.draw_progress_bar(display, 20, h - 25, bar_w, 8, slice_ratio, color=(0, 200, 255))

        # Action Watermark
        if last_action_str and last_action_str != "NONE":
            cv2.putText(display, f"Cmd: {last_action_str}", (w - 240, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 255, 100), 1)

        return display
