export interface CanvasSize {
  width: number
  height: number
}

export interface CanvasPreset {
  value: string
  label: string
  width: number
  height: number
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { value: 'tiktok', label: 'TikTok (960×1600)', width: 960, height: 1600 },
  { value: 'a4', label: 'A4 (2480×3508)', width: 2480, height: 3508 },
  { value: 'hd', label: 'HD (1280×720)', width: 1280, height: 720 },
  { value: 'fullhd', label: 'Full HD (1920×1080)', width: 1920, height: 1080 },
]

export const DEFAULT_CANVAS_SIZE: CanvasSize = {
  width: CANVAS_PRESETS[0].width,
  height: CANVAS_PRESETS[0].height,
}

export const CUSTOM_PRESET_VALUE = 'custom'

export function matchPreset(size: CanvasSize): string {
  const hit = CANVAS_PRESETS.find((p) => p.width === size.width && p.height === size.height)
  return hit ? hit.value : CUSTOM_PRESET_VALUE
}
