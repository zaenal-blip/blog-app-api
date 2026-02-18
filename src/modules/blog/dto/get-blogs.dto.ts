import { IsOptional, IsString } from "class-validator";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto.js";

export class GetBlogsDto extends PaginationQueryParams {

    @IsOptional()
    @IsString()
    search: string = "";
}