from typing import List
from sqlmodel import delete, select
from mcp_proxy.database.session import async_session_getter
from mcp_proxy.database.models.register_task import RegisterMcpTask



class RegisterMcpTaskDao:

    @classmethod
    async def create_task(cls, task: RegisterMcpTask) -> RegisterMcpTask:
        async with async_session_getter() as session:
            session.add(task)
            await session.commit()
            await session.refresh(task)
            return task

    @classmethod
    async def delete_task(cls, task_id: str):
        async with async_session_getter() as session:
            statement = delete(RegisterMcpTask).where(
                RegisterMcpTask.id == task_id
            )

            result = await session.exec(statement)
            return result

    @classmethod
    async def add_task_message(cls, task_id: str, message: dict):
        async with async_session_getter() as session:
            task = await session.get(RegisterMcpTask, task_id)

            if not task:
                raise ValueError(f"Task {task_id} not found")

            task.messages = (task.messages or []) + [message]
            await session.commit()
            return task

    @classmethod
    async def get_task(cls, task_id: str) -> RegisterMcpTask:
        async with async_session_getter() as session:
            task = await session.get(RegisterMcpTask, task_id)
            return task

    @classmethod
    async def get_all_tasks(cls) -> List[RegisterMcpTask]:
        async with async_session_getter() as session:
            statement = select(RegisterMcpTask)
            results = await session.exec(statement)
            return results


    @classmethod
    async def create_task_if_not_exists(cls, task_id: str):
        async with async_session_getter() as session:
            task = await session.get(RegisterMcpTask, task_id)

            if not task:
                task = RegisterMcpTask(
                    id=task_id
                )
                session.add(task)
                await session.commit()
                await session.refresh(task)
            return task