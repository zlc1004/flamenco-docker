import bpy

print("=== Simple GPU Force Script ===")

# Force GPU rendering immediately
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'GPU'

# Get preferences and force CUDA
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'CUDA'
prefs.get_devices()

# Enable CUDA, disable CPU
for device in prefs.devices:
    device.use = (device.type == 'CUDA')
    if device.use:
        print(f"✓ Using: {device.name}")

print("=== GPU Forced ===")