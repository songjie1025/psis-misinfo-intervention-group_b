"""
gemini_client.py — Google Gemini LLM 客户端

替代 claude_client.py，用相同的 ask(prompt) 接口，
可以直接插入 factcheck 管线中使用。

Gemini 在这个项目里的三个作用：
  ① 提取声明（Claim Extraction）：从 X 帖子里拆出独立的声明句子
  ② 对齐判断（Claim Alignment）：判断 Google FactCheck API 的结果是否跟声明相关
  ③ 生成解释（Explanation Generation）：把判定结果翻译成用户能看懂的话

API Key 获取方式：
  1. 打开 https://aistudio.google.com/
  2. 登录 Google 账号
  3. 左侧菜单 → "Get API Key"
  4. 点击 "Create API Key"
  5. 复制 key 到 .env 的 GEMINI_API_KEY 字段

免费额度：Gemini 2.5 Flash 每天 1,500 次请求，对于原型测试完全够用。
"""

from __future__ import annotations

import requests


class GeminiClient:
    """Google Gemini API 客户端，接口兼容 ClaudeClient.

    用法：
        client = GeminiClient(api_key="your-key")
        reply = client.ask("What is 2+2?")
    """

    # Gemini 2.5 Flash — 免费层最快最便宜的模型
    DEFAULT_MODEL = "gemini-2.5-flash"

    # Google AI Studio REST API 端点
    API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        """初始化客户端。

        Args:
            api_key: Google AI Studio 的 API key
            model: 模型名，默认 gemini-2.5-flash
        """
        self.api_key = api_key
        self.model = model

    def ask(self, prompt: str) -> str:
        """发 prompt 给 Gemini，返回文字回复。

        这是跟 ClaudeClient.ask() 完全一样的接口，
        所以可以直接替换 pipeline.py 里的 claude_client。
        """
        url = f"{self.API_URL}/{self.model}:generateContent"
        response = requests.post(
            url,
            params={"key": self.api_key},
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,  # 低温度 = 更稳定的事实判断
                    "maxOutputTokens": 1024,
                },
            },
        )
        response.raise_for_status()
        data = response.json()

        # Gemini 的返回结构：
        # {"candidates": [{"content": {"parts": [{"text": "..."}]}}]}
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            # 如果被安全过滤了，返回原因
            finish_reason = (
                data.get("candidates", [{}])[0]
                .get("finishReason", "UNKNOWN")
            )
            return f"[Gemini blocked: {finish_reason}]"


# ================================================================
# 自测：如果直接运行此文件，做一个最简单的连通性测试
# ================================================================
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv

    load_dotenv()
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        print("❌ 请先设置 GEMINI_API_KEY 环境变量")
        print("   获取方式: https://aistudio.google.com/ → Get API Key")
        exit(1)

    client = GeminiClient(api_key=key)
    try:
        reply = client.ask("Say hello in one short sentence.")
        print(f"✅ Gemini 连通成功！回复：{reply}")
    except Exception as e:
        print(f"❌ 调用失败：{e}")
