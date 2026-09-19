import { zernioFetch, makeRequestId } from "@/lib/zernio/client";
import { getDefaultTimezone } from "@/lib/zernio/config";
import type {
  CreatePostInput,
  ZernioPost,
  PostStatus,
} from "@/lib/zernio/types";

/**
 * POST /v1/posts
 *
 * Modos soportados (mutuamente excluyentes):
 *  - `scheduledFor` + `timezone` -> publica a esa hora local.
 *  - `publishNow: true`          -> publica de inmediato.
 *  - ninguno                     -> se guarda como borrador.
 *
 * Enviamos siempre `x-request-id` para que un reintento devuelva el mismo post
 * en lugar de crear un duplicado (Zernio deduplica por hash de contenido 24 h).
 */
export async function createPost(
  input: CreatePostInput,
): Promise<ZernioPost> {
  const body: Record<string, unknown> = {
    content: input.content,
    platforms: input.platforms,
    timezone: input.timezone ?? getDefaultTimezone(),
  };

  if (input.mediaItems?.length) body.mediaItems = input.mediaItems;
  if (input.firstComment) body.firstComment = input.firstComment;
  if (input.scheduledFor) body.scheduledFor = input.scheduledFor;
  if (input.publishNow) body.publishNow = true;
  if (input.isDraft) body.isDraft = true;

  const { post } = await zernioFetch<{ post: ZernioPost }>("/posts", {
    method: "POST",
    body,
    requestId: makeRequestId("post"),
  });
  return post;
}

/** GET /v1/posts — listado paginado con filtros. */
export async function listPosts(params: {
  profileId?: string;
  status?: PostStatus | "all";
  platform?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
} = {}): Promise<ZernioPost[]> {
  const result = await zernioFetch<{ posts?: ZernioPost[] }>("/posts", {
    query: {
      profileId: params.profileId,
      status: params.status === "all" ? undefined : params.status,
      platform: params.platform,
      fromDate: params.fromDate,
      toDate: params.toDate,
      page: params.page,
      limit: params.limit,
    },
  });
  return result.posts ?? [];
}

/** GET /v1/posts/{postId} */
export async function getPost(postId: string): Promise<ZernioPost> {
  const { post } = await zernioFetch<{ post: ZernioPost }>(`/posts/${postId}`);
  return post;
}

/** DELETE /v1/posts/{postId} */
export async function deletePost(postId: string): Promise<void> {
  await zernioFetch<void>(`/posts/${postId}`, { method: "DELETE" });
}

/**
 * POST /v1/posts con `publishNow` sobre un contenido ya programado se resuelve
 * creando un post nuevo; para el dashboard exponemos el helper explícito.
 */
export async function publishNow(input: CreatePostInput): Promise<ZernioPost> {
  return createPost({ ...input, publishNow: true, scheduledFor: undefined });
}
