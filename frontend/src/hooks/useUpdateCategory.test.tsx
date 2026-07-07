import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { useUpdateCategory } from "@/hooks/useUpdateCategory";
import { queryKeys } from "@/lib/queryKeys";
import {
  createTestQueryClient,
  createWrapper,
  renderHook,
  waitFor,
} from "@/test/utils";
import { server } from "@/test/mocks/server";
import {
  mockCategories,
  mockCategoryUnseenCount,
} from "@/test/mocks/handlers/categories";

describe("useUpdateCategory", () => {
  it("does not show the generic toast on a 409 rename collision", async () => {
    server.use(
      http.patch(
        "/api/categories/:id",
        () =>
          HttpResponse.json(
            { detail: "Category name already exists" },
            { status: 409 },
          ),
        { once: true },
      ),
    );
    const toastSpy = vi.spyOn(toast, "error");

    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 1, data: { display_name: "Finance" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("shows the generic toast on a non-409 error", async () => {
    server.use(
      http.patch(
        "/api/categories/:id",
        () => HttpResponse.json({ detail: "Server error" }, { status: 500 }),
        { once: true },
      ),
    );
    const toastSpy = vi.spyOn(toast, "error");

    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 1, data: { display_name: "Finance" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastSpy).toHaveBeenCalledWith(
      "Failed to update category",
      expect.objectContaining({ description: "Server error" }),
    );
  });

  it("does not throw when a triageCount ({count}) query shares the categories key prefix during an optimistic weight update", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.categories.list(), mockCategories);
    queryClient.setQueryData(
      queryKeys.categories.triageCount,
      mockCategoryUnseenCount,
    );
    // vi.spyOn re-wraps an already-spied `toast.error` (from the earlier
    // tests in this file) rather than resetting it, so its call history
    // carries over; clear it so only this test's calls are asserted.
    const toastSpy = vi.spyOn(toast, "error");
    toastSpy.mockClear();

    const { result } = renderHook(() => useUpdateCategory(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ id: 1, data: { weight: "boost" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toastSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.categories.triageCount)).toEqual(
      mockCategoryUnseenCount,
    );
  });
});
