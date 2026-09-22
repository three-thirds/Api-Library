export type ApiParams = {
    name: string;
    type: string;
    required: boolean;
    example: string;
    description: string;
}

export type ApiResponse = {
    code: number;
    message: string;
}

export type ApiEntry = {
    id: string;
    name: string;
    description: string;
    method: string;
    auth: boolean;
    params: ApiParams[];
    response: unknown;
    errors: ApiResponse[];
}