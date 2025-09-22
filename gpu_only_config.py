import bpy

# Force Cycles GPU-only configuration
print("=== Configuring Blender for GPU-only rendering ===")

# Set render engine to Cycles
bpy.context.scene.render.engine = 'CYCLES'

# Force GPU device
bpy.context.scene.cycles.device = 'GPU'

# Get cycles preferences
prefs = bpy.context.preferences.addons['cycles'].preferences

# Set compute device type to CUDA
prefs.compute_device_type = 'CUDA'

# Disable all CPU devices, enable only CUDA devices
for device in prefs.devices:
    if device.type == 'CUDA':
        device.use = True
        print(f"Enabled CUDA device: {device.name}")
    else:
        device.use = False
        print(f"Disabled device: {device.name} ({device.type})")

print("=== GPU-only configuration complete ===")
print(f"Render engine: {bpy.context.scene.render.engine}")
print(f"Device: {bpy.context.scene.cycles.device}")
print(f"Compute device type: {prefs.compute_device_type}")

# Count enabled devices by type
cuda_devices = sum(1 for device in prefs.devices if device.type == 'CUDA' and device.use)
cpu_devices = sum(1 for device in prefs.devices if device.type == 'CPU' and device.use)
print(f"CUDA devices enabled: {cuda_devices}")
print(f"CPU devices enabled: {cpu_devices}")