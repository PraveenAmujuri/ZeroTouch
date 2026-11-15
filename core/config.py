"""
ZeroTouch Configuration Module
Centralized parameters for camera, two-hand gesture detection, smoothing, thresholds, and UI.
Based on Bockhacker et al. (2020) OR Touchless Interface Design.
"""

from dataclasses import dataclass, field
from typing import Tuple


@dataclass
class CameraConfig:
    device_index: int = 0
    width: int = 640
    height: int = 480
    fps: int = 30
    flip_horizontal: bool = True  # Natural mirror interaction
    # Preprocessing
    enable_clahe: bool = False    # Raw frame provides superior MediaPipe tracking
    clahe_clip_limit: float = 2.0
    clahe_tile_grid: Tuple[int, int] = (8, 8)
    low_light_threshold: float = 50.0
    # MediaPipe Hands - Two-hand tracking support
    max_num_hands: int = 2
    min_detection_confidence: float = 0.70
    min_tracking_confidence: float = 0.70


@dataclass
class FilterConfig:
    # OneEuroFilter smoothing parameters for landmark jitter reduction
    min_cutoff: float = 1.2       # Cutoff at rest (Hz)
    beta: float = 0.5             # Speed coefficient (responsive motion)
    d_cutoff: float = 1.0


@dataclass
class GestureThresholds:
    # Pose confirmation and temporal stability (seconds)
    mode_switch_hold_time: float = 0.60     # Matching finger-count hold time to select mode
    mode_switch_cooldown: float = 0.70      # Debounce to prevent multiple cycles in one hold
    window_change_hold_time: float = 0.45   # Hand + Hand hold to toggle/cycle viewing window
    window_change_cooldown: float = 0.60    # Debounce for window switching

    # Directional Action Execution (Hand + Fist or Fist + Hand)
    # Movement is measured relative to chest/hand scale
    action_deadzone: float = 0.02           # Deadzone for continuous movements
    action_cooldown: float = 0.03           # Cadence for continuous dragging (zoom, windowing, panning)

    # Mode-specific sensitivities (normalized by palm scale)
    slice_step_delay: float = 0.28          # Seconds between slice advance when holding directional pose
    zoom_sensitivity: float = 0.045         # Continuous zoom multiplier per frame
    preset_switch_delay: float = 0.50       # Seconds between successive preset steps when holding in WINDOWING mode
    window_center_sensitivity: float = 15.0 # (Preserved fallback)
    window_width_sensitivity: float = 20.0  # (Preserved fallback)
    # Panning configuration (Step-based matching finger directional navigation)
    pan_step_distance: float = 25.0         # Pixels per step (configurable movement distance)
    pan_step_delay: float = 0.28            # Interval (seconds) between repeated steps when held
    pan_gesture_hold_time: float = 0.18     # Stability time (seconds) required before first step triggers
    pan_sensitivity: float = 12.0           # Preserved fallback

    # Neutral/Background pose and clutch
    neutral_release_delay: float = 0.10     # Delay to cleanly stop action on neutral posture
    hand_loss_timeout: float = 0.40         # Seconds before clearing active hand tracking


@dataclass
class UIConfig:
    window_name: str = "ZeroTouch - Touchless Medical Imaging Interface (Bockhacker et al. Two-Hand OR Interaction)"
    display_width: int = 640
    display_height: int = 640
    cam_preview_width: int = 640
    cam_preview_height: int = 640
    font_scale: float = 0.65
    font_thickness: int = 2
    show_debug_overlay: bool = True
    color_idle: Tuple[int, int, int] = (70, 70, 220)        # Soft Red/Coral
    color_active: Tuple[int, int, int] = (50, 205, 50)      # Lime Green
    color_gesture: Tuple[int, int, int] = (255, 215, 0)     # Gold/Amber
    color_accent: Tuple[int, int, int] = (240, 240, 240)    # Crisp Off-white
    color_bg_dark: Tuple[int, int, int] = (24, 24, 28)      # Modern dark slate


@dataclass
class ZeroTouchConfig:
    camera: CameraConfig = field(default_factory=CameraConfig)
    filter: FilterConfig = field(default_factory=FilterConfig)
    gestures: GestureThresholds = field(default_factory=GestureThresholds)
    ui: UIConfig = field(default_factory=UIConfig)


# Default global instance
config = ZeroTouchConfig()
