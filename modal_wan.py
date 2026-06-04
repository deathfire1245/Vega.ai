import modal
import io
import os
import base64
import tempfile

app = modal.App("vega-wan22")

model_volume = modal.Volume.from_name("wan22-weights", create_if_missing=True)

wan_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install([
        "torch==2.5.1",
        "torchvision",
        "diffusers==0.35.0",
        "transformers==4.46.3",
        "accelerate==0.34.2",
        "huggingface_hub",
        "sentencepiece",
        "imageio",
        "imageio-ffmpeg",
        "Pillow",
        "numpy",
        "ftfy",
        "fastapi[standard]",
    ])
)

@app.cls(
    image=wan_image,
    gpu="A100-40GB",
    timeout=900,
    scaledown_window=300,
    volumes={"/model-cache": model_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
class Wan22:

    @modal.enter()
    def load_model(self):
        from diffusers import WanPipeline
        import torch

        model_id = "Wan-AI/Wan2.2-T2V-A14B-Diffusers"
        cache_dir = "/model-cache/wan22-t2v"

        print("[WAN] Loading T2V pipeline v2...")
        self.pipe = WanPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
            cache_dir=cache_dir,
        )
        self.pipe.enable_model_cpu_offload()
        print("[WAN] Model loaded.")

    @modal.method()
    def generate_video(self, prompt: str, num_frames: int = 81, width: int = 832, height: int = 480):
        import imageio
        import numpy as np

        print(f"[WAN] Generating video — frames: {num_frames}")
        output = self.pipe(
            prompt=prompt,
            num_frames=num_frames,
            width=width,
            height=height,
            guidance_scale=5.0,
            num_inference_steps=25,
        )
        frames = output.frames[0]

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            path = f.name

        writer = imageio.get_writer(path, fps=16, codec="libx264", quality=8)
        for frame in frames:
            writer.append_data(np.array(frame))
        writer.close()

        with open(path, "rb") as f:
            video_bytes = f.read()

        return video_bytes

    @modal.method()
    def generate_image(self, prompt: str, width: int = 832, height: int = 480):
        output = self.pipe(
            prompt=prompt,
            num_frames=1,
            width=width,
            height=height,
            guidance_scale=5.0,
            num_inference_steps=25,
        )
        frame = output.frames[0][0]
        buf = io.BytesIO()
        frame.save(buf, format="PNG")
        return buf.getvalue()

    @modal.fastapi_endpoint(method="POST")
    def generate(self, item: dict):
        prompt = item.get("prompt", "")
        content_type = item.get("type", "video")
        num_frames = item.get("num_frames", 81)

        if content_type == "image":
            result = self.generate_image.local(prompt)
            return {
                "type": "image",
                "data": base64.b64encode(result).decode(),
                "format": "png"
            }
        else:
            result = self.generate_video.local(prompt, num_frames=num_frames)
            return {
                "type": "video",
                "data": base64.b64encode(result).decode(),
                "format": "mp4"
            }
