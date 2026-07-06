import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { useUpdateCategory } from "@/hooks/useUpdateCategory";
import { createWrapper, renderHook, waitFor } from "@/test/utils";
import { server } from "@/test/mocks/server";

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
});
