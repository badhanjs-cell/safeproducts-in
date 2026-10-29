import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]

class CloudRunOcrContractTests(unittest.TestCase):
    def test_existing_container_is_cloud_run_compatible(self):
        text=(ROOT/"services/m1br-ocr/Dockerfile").read_text()
        self.assertIn("PORT=8080", text)
        self.assertIn("EXPOSE 8080", text)
        self.assertIn("uvicorn app:app --host 0.0.0.0", text)
        self.assertIn("${PORT:-8080}", text)
        self.assertIn("--workers 1", text)

    def test_build_context_excludes_env_files(self):
        text=(ROOT/"services/m1br-ocr/.dockerignore").read_text()
        self.assertIn(".env", text)
        self.assertIn(".env*", text)

    def test_cloud_build_is_scoped_to_ocr_subservice(self):
        text=(ROOT/"cloudbuild.m1br-ocr.yaml").read_text()
        self.assertIn("services/m1br-ocr/Dockerfile", text)
        self.assertIn("services/m1br-ocr", text)
        self.assertIn("_SERVICE_NAME: safeproducts-m1br-ocr", text)
        self.assertIn("_DEPLOY_REGION: asia-south1", text)
        self.assertIn("--concurrency=1", text)
        self.assertIn("--memory=4Gi", text)
        self.assertIn("--update-secrets=M1BR_OCR_TOKEN=", text)

    def test_edge_worker_supports_runtime_url_override(self):
        text=(ROOT/"supabase/functions/sp-m1br-recovery-worker-v1/index.ts").read_text()
        self.assertIn('Deno.env.get("M1BR_OCR_URL")', text)
        self.assertIn("deriveOcrToken", text)
        self.assertIn("x-m1br-ocr-token", text)

if __name__ == "__main__":
    unittest.main()
