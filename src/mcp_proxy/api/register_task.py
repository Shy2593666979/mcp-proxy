import uuid
from fastapi import APIRouter

from mcp_proxy.database.dao.register_task import RegisterMcpTaskDao
from mcp_proxy.schemas.register_mcp import DeleteMcpTaskRequest
from mcp_proxy.schemas.response import resp_200

router = APIRouter(tags=["Register-Task"])

@router.get("/task/list")
async def get_register_mcp_tasks():
    tasks = await RegisterMcpTaskDao.get_all_tasks()
    result = [task.model_dump() for task in tasks]
    result.sort(key=lambda x: x["updated_time"], reverse=True)
    return resp_200(data=result)


@router.post("/task/create")
async def create_register_mcp_task():
    task_id = str(uuid.uuid4())
    task = await RegisterMcpTaskDao.create_task_if_not_exists(task_id)
    return resp_200(data=task.model_dump())


@router.post("/task/delete")
async def delete_register_mcp_task(
    req: DeleteMcpTaskRequest
):
    result = await RegisterMcpTaskDao.delete_task(req.task_id)
    return resp_200(data=result)

