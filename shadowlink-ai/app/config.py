from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    version: str = "0.1.0"
    debug: bool = False

    # LLM
    llm_base_url: str = "http://127.0.0.1:8000/v1"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""

    # gRPC
    grpc_port: int = 50051

    # RAG
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    faiss_index_path: str = "./data/faiss_index"

    model_config = {"env_prefix": "SHADOWLINK_"}


settings = Settings()
