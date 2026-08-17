from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from src.api.schemas_refinement import (
    CreateMemoryFactRequest,
    CreateProductRequest,
    ProductMemoryItem,
    ProductMemoryListResponse,
    ProductModel,
    UpdateMemoryFactRequest,
)
from src.database import get_db
from src.services.product_memory_service import ProductMemoryService

router = APIRouter(prefix="/api", tags=["product-memory-api"])


@router.get("/products", response_model=list[ProductModel])
async def list_products(db: Session = Depends(get_db)):
    return ProductMemoryService(db).list_products()


@router.post("/products", response_model=ProductModel)
async def create_product(payload: CreateProductRequest, db: Session = Depends(get_db)):
    try:
        return ProductMemoryService(db).create_product(payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: str, db: Session = Depends(get_db)):
    try:
        ProductMemoryService(db).delete_product(product_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.get("/products/{product_id}/memory", response_model=ProductMemoryListResponse)
async def get_product_memory(product_id: str, db: Session = Depends(get_db)):
    try:
        return ProductMemoryService(db).get_memory(product_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/products/{product_id}/memory", response_model=ProductMemoryItem)
async def add_memory_fact(
    product_id: str, payload: CreateMemoryFactRequest, db: Session = Depends(get_db)
):
    try:
        return ProductMemoryService(db).add_fact(product_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/memory/{fact_id}", response_model=ProductMemoryItem)
async def update_memory_fact(
    fact_id: str, payload: UpdateMemoryFactRequest, db: Session = Depends(get_db)
):
    try:
        return ProductMemoryService(db).update_fact(fact_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/memory/{fact_id}", status_code=204)
async def archive_memory_fact(fact_id: str, db: Session = Depends(get_db)):
    try:
        ProductMemoryService(db).archive_fact(fact_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)
