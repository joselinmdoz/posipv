import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales")
  async getSalesReport(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.reportsService.getSalesReport(start, end);
  }
}
