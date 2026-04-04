import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";

@Controller("reports")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("server-date")
  @Permissions("reports.view", "dashboard.view")
  getServerDate() {
    return this.reportsService.getServerDateInfo();
  }

  @Get("sales")
  @Permissions("reports.view", "dashboard.view")
  async getSalesReport(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("channel") channel?: string,
    @Query("warehouseId") warehouseId?: string,
    @Query("cashierEmail") cashierEmail?: string,
    @Query("customerName") customerName?: string,
    @Query("documentNumber") documentNumber?: string,
    @Query("includeManualIvp") includeManualIvp?: string,
  ) {
    return this.reportsService.getSalesReport(startDate, endDate, {
      channel,
      warehouseId,
      cashierEmail,
      customerName,
      documentNumber,
      includeManualIvp,
    });
  }

  @Get("lot-profit")
  @Permissions("reports.view", "dashboard.view")
  async getLotProfitReport(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("channel") channel?: string,
    @Query("warehouseId") warehouseId?: string,
    @Query("productId") productId?: string,
    @Query("purchaseId") purchaseId?: string,
    @Query("includeAdjustments") includeAdjustments?: string,
  ) {
    return this.reportsService.getLotProfitReport(startDate, endDate, {
      channel,
      warehouseId,
      productId,
      purchaseId,
      includeAdjustments,
    });
  }
}
