import { IsOptional, IsNumber, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class PaginationQueryParams {
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseInt(value))
    page: number = 1;

    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseInt(value))
    take: number = 10;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => value)
    sortBy: string = "createdAt";

    @IsOptional()
    @IsString()
    @Transform(({ value }) => value)
    sortOrder: string = "desc";
}