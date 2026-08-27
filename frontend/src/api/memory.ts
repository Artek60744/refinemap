import { apiFetch } from "./client";
import type {
  CreateMemoryFactRequest,
  CreateProductRequest,
  ProductMemoryItem,
  ProductMemoryListResponse,
  ProductModel,
  UpdateMemoryFactRequest,
} from "../types/api";

export function listProducts(): Promise<ProductModel[]> {
  return apiFetch("/api/products");
}

export function createProduct(payload: CreateProductRequest): Promise<ProductModel> {
  return apiFetch("/api/products", { method: "POST", body: JSON.stringify(payload) });
}

export function deleteProduct(productId: string): Promise<void> {
  return apiFetch(`/api/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
}

export function getProductMemory(productId: string): Promise<ProductMemoryListResponse> {
  return apiFetch(`/api/products/${encodeURIComponent(productId)}/memory`);
}

export function addMemoryFact(
  productId: string,
  payload: CreateMemoryFactRequest,
): Promise<ProductMemoryItem> {
  return apiFetch(`/api/products/${encodeURIComponent(productId)}/memory`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMemoryFact(
  factId: string,
  payload: UpdateMemoryFactRequest,
): Promise<ProductMemoryItem> {
  return apiFetch(`/api/memory/${encodeURIComponent(factId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function archiveMemoryFact(factId: string): Promise<void> {
  return apiFetch(`/api/memory/${encodeURIComponent(factId)}`, { method: "DELETE" });
}
