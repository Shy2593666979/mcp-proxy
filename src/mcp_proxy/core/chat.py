from openai import OpenAI

class AbstractMcpAgent:

    def __init__(self):
        self.client = OpenAI(
            base_url=
        )