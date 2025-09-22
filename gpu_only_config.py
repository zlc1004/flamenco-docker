import bpy
import sys

def force_gpu_rendering():
    """Force GPU rendering configuration after scene is loaded"""
    print("=== Forcing GPU Configuration After Scene Load ===")
    
    try:
        # Set render engine to Cycles
        bpy.context.scene.render.engine = 'CYCLES'
        print(f"✓ Render engine set to: {bpy.context.scene.render.engine}")

        # Force GPU device
        bpy.context.scene.cycles.device = 'GPU'
        print(f"✓ Cycles device set to: {bpy.context.scene.cycles.device}")

        # Get cycles preferences
        prefs = bpy.context.preferences.addons['cycles'].preferences
        
        # Set compute device type to CUDA
        prefs.compute_device_type = 'CUDA'
        print(f"✓ Compute device type set to: {prefs.compute_device_type}")

        # Refresh devices to ensure CUDA is available
        prefs.get_devices()
        
        # Force enable CUDA devices, disable CPU
        cuda_count = 0
        for device in prefs.devices:
            if device.type == 'CUDA':
                device.use = True
                cuda_count += 1
                print(f"✓ Enabled CUDA device: {device.name}")
            else:
                device.use = False
                print(f"✗ Disabled device: {device.name} ({device.type})")
        
        # Force scene-specific settings
        if hasattr(bpy.context.scene.cycles, 'feature_set'):
            bpy.context.scene.cycles.feature_set = 'SUPPORTED'
        
        # Force GPU compute device
        bpy.context.scene.cycles.device = 'GPU'
        
        print(f"SUCCESS: GPU rendering forced with {cuda_count} CUDA device(s)")
        return cuda_count > 0
        
    except Exception as e:
        print(f"ERROR in GPU configuration: {str(e)}")
        return False

# Initial GPU Configuration
print("=== Starting GPU Configuration Script ===")
print(f"Blender version: {bpy.app.version_string}")

# Set up GPU configuration immediately
force_gpu_rendering()

# Also set up a timer to re-apply GPU settings after scene load
def reapply_gpu_settings():
    """Timer function to reapply GPU settings"""
    print("=== Reapplying GPU Settings (Timer) ===")
    force_gpu_rendering()
    return None  # Don't repeat

# Register timer to run after scene is fully loaded
bpy.app.timers.register(reapply_gpu_settings, first_interval=0.1)

print("=== GPU Configuration Script Complete ===")
print()