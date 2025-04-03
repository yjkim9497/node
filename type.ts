type ApiTYpe = "axios" | "prisma" | "unknown";

export type ApiResponse<T> = {
    meta: {ok: boolean; type?: ApiTYpe};
    data: { message: string} & T;
};

export type ApiErrorResponse = ApiResponse<{}>;