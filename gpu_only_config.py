import bpy

def force_gpu_configuration():
    """Force GPU configuration function"""
    try:
        print("=== Forcing GPU Configuration ===")
        
        # Set render engine to Cycles
        bpy.context.scene.render.engine = 'CYCLES'
        print("✓ Render engine set to CYCLES")

        # Get cycles preferences first
        prefs = bpy.context.preferences.addons['cycles'].preferences
        
        # Set compute device type to CUDA FIRST
        prefs.compute_device_type = 'CUDA'
        print("✓ Compute device type set to CUDA")

        # Refresh devices and force CUDA
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
        
        # AFTER setting up devices, force GPU device on scene
        bpy.context.scene.cycles.device = 'GPU'
        print("✓ Cycles device set to GPU")
        
        # Additional scene-level GPU forcing
        if hasattr(bpy.context.scene.cycles, 'samples'):
            print(f"Current samples: {bpy.context.scene.cycles.samples}")
        
        print(f"CUDA devices enabled: {cuda_count}")
        print(f"Scene cycles device: {bpy.context.scene.cycles.device}")
        return cuda_count > 0
        
    except Exception as e:
        print(f"ERROR in GPU configuration: {e}")
        return False

# Initial GPU Configuration
print("=== Initial GPU Configuration Script ===")
force_gpu_configuration()

# Set up multiple timers to aggressively re-force GPU settings
def reapply_gpu_timer():
    """Timer function to reapply GPU settings after scene load"""
    print("=== Timer: Re-applying GPU Settings After Scene Load ===")
    success = force_gpu_configuration()
    if success:
        print("✓ GPU settings successfully reapplied after scene load")
    return None  # Don't repeat the timer

def late_gpu_timer():
    """Later timer to catch any final overrides"""
    print("=== Late Timer: Final GPU Configuration Check ===")
    success = force_gpu_configuration()
    if success:
        print("✓ Final GPU settings applied")
    return None

# Register multiple timers to catch different loading phases
bpy.app.timers.register(reapply_gpu_timer, first_interval=0.1)  # Very early
bpy.app.timers.register(late_gpu_timer, first_interval=1.0)     # Later check

print("=== GPU Configuration Script Complete ===")
print("Multiple timers registered to aggressively enforce GPU settings")