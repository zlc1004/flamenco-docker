// SPDX-License-Identifier: GPL-3.0-or-later

const JOB_TYPE = {
    label: "Simple Blender Render (No Video)",
    description: "Render a sequence of frames without creating preview video",
    settings: [
        // Settings for artists to determine:
        { key: "frames", type: "string", required: true,
          eval: "f'{C.scene.frame_start}-{C.scene.frame_end}'",
          evalInfo: {
            showLinkButton: true,
            description: "Scene frame range",
          },
          description: "Frame range to render. Examples: '47', '1-30', '3, 5-10, 47-327'" },
        { key: "chunk_size", type: "int32", default: 1, description: "Number of frames to render in one Blender render task",
          visible: "submission" },

        { key: "render_output_path", type: "string", subtype: "file_path", editable: false,
          eval: "f'{jobname}/render/######'",
          description: "Final file path of where render output will be saved"},

        // Automatically evaluated settings:
        { key: "blendfile", type: "string", required: true, description: "Path of the Blend file to render", visible: "web" },
        { key: "format", type: "string", required: true, eval: "C.scene.render.image_settings.file_format", visible: "web" },
        { key: "image_file_extension", type: "string", required: true, eval: "C.scene.render.file_extension", visible: "hidden",
          description: "File extension used when rendering images" },
        { key: "scene", type: "string", required: true, eval: "C.scene.name", visible: "web",
          description: "Name of the scene to render."},
    ]
};


function compileJob(job) {
    print("Blender Render job submitted (No Video)");
    print("job: ", job);

    const settings = job.settings;
    const renderOutput = renderOutputPath(job);

    // Make sure that when the job is investigated later, it shows the
    // actually-used render output:
    settings.render_output_path = renderOutput;

    const renderDir = path.dirname(renderOutput);
    const renderTasks = authorRenderTasks(settings, renderDir, renderOutput);

    for (const rt of renderTasks) {
        job.addTask(rt);
    }
}

// Do field replacement on the render output path.
function renderOutputPath(job) {
    let path = job.settings.render_output_path;
    if (!path) {
        throw "no render_output_path setting!";
    }
    return path.replace(/{([^}]+)}/g, (match, group0) => {
        switch (group0) {
        case "timestamp":
            return formatTimestampLocal(job.created);
        default:
            return match;
        }
    });
}

function authorRenderTasks(settings, renderDir, renderOutput) {
    print("authorRenderTasks(", renderDir, renderOutput, ")");
    let renderTasks = [];
    let chunks = frameChunker(settings.frames, settings.chunk_size);

    let baseArgs = [];
    if (settings.scene) {
      baseArgs = baseArgs.concat(["--scene", settings.scene]);
    }

    for (let chunk of chunks) {
        const task = author.Task(`render-${chunk}`, "blender");
        const command = author.Command("blender-render", {
            exe: "{blender}",
            exeArgs: "{blenderArgs}",
            argsBefore: [],
            blendfile: settings.blendfile,
            args: baseArgs.concat([
                "--render-output", path.join(renderDir, path.basename(renderOutput)),
                "--render-format", settings.format,
                "--render-frame", chunk.replaceAll("-", ".."), // Convert to Blender frame range notation.
            ])
        });
        task.addCommand(command);
        renderTasks.push(task);
    }
    return renderTasks;
}
