import os, uuid
import boto3
from botocore.config import Config

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
    config=Config(signature_version="s3v4"),
)

R2_BUCKET = os.environ.get("R2_BUCKET", "thriftbuddy-temp")
PUBLIC_BASE = os.environ["R2_PUBLIC_IMG_BASE"]  # your Worker URL

def _safe_ext(filename: str | None) -> str:
    if not filename or "." not in filename:
        return "jpg"
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext if ext in ("jpg", "jpeg", "png", "webp") else "jpg"

async def upload_uploadfile_and_get_url(upload_file, prefix="tmp") -> str:
    data = await upload_file.read()
    ext = _safe_ext(getattr(upload_file, "filename", None))
    key = f"{prefix}/{uuid.uuid4().hex}.{ext}"

    s3.put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=data,
        ContentType=getattr(upload_file, "content_type", None) or "image/jpeg",
    )

    return f"{PUBLIC_BASE}/{key}"
