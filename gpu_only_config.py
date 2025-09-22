import bpy
import sys

# Force Cycles GPU-only configuration
print("=== Starting GPU Configuration Script ===")
print(f"Blender version: {bpy.app.version_string}")

try:
    # Set render engine to Cycles
    bpy.context.scene.render.engine = 'CYCLES'
    print(f"✓ Render engine set to: {bpy.context.scene.render.engine}")

    # Force GPU device
    bpy.context.scene.cycles.device = 'GPU'
    print(f"✓ Cycles device set to: {bpy.context.scene.cycles.device}")

    # Get cycles preferences
    prefs = bpy.context.preferences.addons['cycles'].preferences
    print(f"✓ Got Cycles preferences")

    # Set compute device type to CUDA
    prefs.compute_device_type = 'CUDA'
    print(f"✓ Compute device type set to: {prefs.compute_device_type}")

    # Refresh devices to ensure CUDA is available
    prefs.get_devices()
    print(f"✓ Refreshed device list")

    # List all available devices first
    print("Available devices:")
    for i, device in enumerate(prefs.devices):
        print(f"  {i}: {device.name} ({device.type}) - Use: {device.use}")

    # Disable all CPU devices, enable only CUDA devices
    cuda_count = 0
    cpu_count = 0
    for device in prefs.devices:
        if device.type == 'CUDA':
            device.use = True
            cuda_count += 1
            print(f"✓ Enabled CUDA device: {device.name}")
        else:
            device.use = False
            cpu_count += 1
            print(f"✗ Disabled device: {device.name} ({device.type})")

    print("=== GPU Configuration Complete ===")
    print(f"Render engine: {bpy.context.scene.render.engine}")
    print(f"Device: {bpy.context.scene.cycles.device}")
    print(f"Compute device type: {prefs.compute_device_type}")
    print(f"CUDA devices enabled: {cuda_count}")
    print(f"Other devices disabled: {cpu_count}")
    
    if cuda_count == 0:
        print("WARNING: No CUDA devices found or enabled!")
    else:
        print(f"SUCCESS: GPU rendering configured with {cuda_count} CUDA device(s)")

except Exception as e:
    print(f"ERROR in GPU configuration: {str(e)}")
    import traceback
    traceback.print_exc()
    print("Falling back to CPU rendering")

print("=== GPU Configuration Script Complete ===")
print()