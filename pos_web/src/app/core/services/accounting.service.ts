import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type AccountingAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type AccountingPeriodStatus = 'OPEN' | 'CLOSED';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOID';
export type JournalLineSide = 'DEBIT' | 'CREDIT';
export type CurrencyCode = 'CUP' | 'USD';
export type AccountingPostingRuleKey =
  | 'SALE_REVENUE_CUP'
  | 'SALE_REVENUE_USD'
  | 'SALE_COGS'
  | 'STOCK_IN'
  | 'STOCK_OUT';

export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  type: AccountingAccountType;
  description?: string | null;
  allowManualEntries: boolean;
  active: boolean;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
  closeNotes?: string | null;
  closedAt?: string | null;
  closedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntrySummary {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string | null;
  status: JournalEntryStatus;
  totalDebit: number;
  totalCredit: number;
  currency: CurrencyCode;
  period?: { id: string; name: string; status: AccountingPeriodStatus } | null;
  createdBy?: { id: string; email: string } | null;
  postedBy?: { id: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  side: JournalLineSide;
  amount: number;
  memo?: string;
  account?: AccountingAccount;
}

export interface JournalEntryDetail extends JournalEntrySummary {
  lines: JournalEntryLine[];
}

export interface AccountingPostingRule {
  id: string;
  key: AccountingPostingRuleKey;
  name: string;
  description?: string | null;
  active: boolean;
  debitAccountId: string;
  creditAccountId: string;
  debitAccount: {
    id: string;
    code: string;
    name: string;
    active: boolean;
  };
  creditAccount: {
    id: string;
    code: string;
    name: string;
    active: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AccountingJournalReport {
  filters: {
    periodId: string | null;
    fromDate: string | null;
    toDate: string | null;
    includeDraft: boolean;
    includeVoid: boolean;
  };
  totals: {
    totalDebit: number;
    totalCredit: number;
    entries: number;
  };
  entries: JournalEntryDetail[];
}

export interface AccountingLedgerReport {
  filters: {
    periodId: string | null;
    fromDate: string | null;
    toDate: string | null;
    includeDraft: boolean;
    includeVoid: boolean;
  };
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountingAccountType;
  };
  opening: {
    debit: number;
    credit: number;
    balance: number;
  };
  totals: {
    debit: number;
    credit: number;
    closingBalance: number;
  };
  movements: Array<{
    id: string;
    date: string;
    entryId: string;
    entryNumber: string;
    description: string;
    reference?: string | null;
    status: JournalEntryStatus;
    period?: { id: string; name: string } | null;
    debit: number;
    credit: number;
    balance: number;
    memo?: string | null;
  }>;
}

export interface AccountingTrialBalanceReport {
  filters: {
    periodId: string | null;
    fromDate: string | null;
    toDate: string | null;
    includeDraft: boolean;
    includeVoid: boolean;
  };
  totals: {
    debit: number;
    credit: number;
    difference: number;
  };
  rows: Array<{
    accountId: string;
    code: string;
    name: string;
    type: AccountingAccountType;
    active: boolean;
    debit: number;
    credit: number;
    balance: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class AccountingService {
  private readonly API_URL = '/api/accounting';

  constructor(private http: HttpClient) {}

  listAccounts(params?: { q?: string; active?: string; type?: AccountingAccountType; limit?: number }): Observable<AccountingAccount[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.active !== undefined) query.set('active', params.active);
    if (params?.type) query.set('type', params.type);
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    return this.http.get<AccountingAccount[]>(`${this.API_URL}/accounts${suffix ? `?${suffix}` : ''}`);
  }

  createAccount(payload: {
    code: string;
    name: string;
    type: AccountingAccountType;
    description?: string;
    allowManualEntries?: boolean;
    active?: boolean;
    parentId?: string;
  }): Observable<AccountingAccount> {
    return this.http.post<AccountingAccount>(`${this.API_URL}/accounts`, payload);
  }

  getAccount(accountId: string): Observable<AccountingAccount> {
    return this.http.get<AccountingAccount>(`${this.API_URL}/accounts/${accountId}`);
  }

  updateAccount(accountId: string, payload: Partial<{
    code: string;
    name: string;
    type: AccountingAccountType;
    description: string;
    allowManualEntries: boolean;
    active: boolean;
    parentId: string;
  }>): Observable<AccountingAccount> {
    return this.http.put<AccountingAccount>(`${this.API_URL}/accounts/${accountId}`, payload);
  }

  deleteAccount(accountId: string): Observable<{ id: string; code: string; name: string }> {
    return this.http.delete<{ id: string; code: string; name: string }>(`${this.API_URL}/accounts/${accountId}`);
  }

  listPostingRules(): Observable<AccountingPostingRule[]> {
    return this.http.get<AccountingPostingRule[]>(`${this.API_URL}/posting-rules`);
  }

  createPostingRule(payload: {
    key: AccountingPostingRuleKey;
    name?: string;
    description?: string;
    active?: boolean;
    debitAccountId?: string;
    creditAccountId?: string;
  }): Observable<AccountingPostingRule> {
    return this.http.post<AccountingPostingRule>(`${this.API_URL}/posting-rules`, payload);
  }

  updatePostingRule(
    key: AccountingPostingRuleKey,
    payload: Partial<{
      name: string;
      description: string;
      active: boolean;
      debitAccountId: string;
      creditAccountId: string;
    }>
  ): Observable<AccountingPostingRule> {
    return this.http.put<AccountingPostingRule>(`${this.API_URL}/posting-rules/${key}`, payload);
  }

  deletePostingRule(key: AccountingPostingRuleKey): Observable<{ id: string; key: AccountingPostingRuleKey; name: string; active: boolean }> {
    return this.http.delete<{ id: string; key: AccountingPostingRuleKey; name: string; active: boolean }>(`${this.API_URL}/posting-rules/${key}`);
  }

  seedDefaultPostingRules(): Observable<AccountingPostingRule[]> {
    return this.http.post<AccountingPostingRule[]>(`${this.API_URL}/posting-rules/bootstrap`, {});
  }

  seedDefaultChart(): Observable<AccountingAccount[]> {
    return this.http.post<AccountingAccount[]>(`${this.API_URL}/accounts/bootstrap`, {});
  }

  listPeriods(params?: { status?: AccountingPeriodStatus; fromDate?: string; toDate?: string; limit?: number }): Observable<FiscalPeriod[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.fromDate) query.set('fromDate', params.fromDate);
    if (params?.toDate) query.set('toDate', params.toDate);
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    return this.http.get<FiscalPeriod[]>(`${this.API_URL}/periods${suffix ? `?${suffix}` : ''}`);
  }

  createPeriod(payload: { name?: string; startDate: string; endDate: string }): Observable<FiscalPeriod> {
    return this.http.post<FiscalPeriod>(`${this.API_URL}/periods`, payload);
  }

  getPeriod(periodId: string): Observable<FiscalPeriod> {
    return this.http.get<FiscalPeriod>(`${this.API_URL}/periods/${periodId}`);
  }

  updatePeriod(periodId: string, payload: { name?: string; startDate: string; endDate: string }): Observable<FiscalPeriod> {
    return this.http.put<FiscalPeriod>(`${this.API_URL}/periods/${periodId}`, payload);
  }

  closePeriod(periodId: string, closeNotes?: string): Observable<FiscalPeriod> {
    return this.http.put<FiscalPeriod>(`${this.API_URL}/periods/${periodId}/close`, { closeNotes });
  }

  reopenPeriod(periodId: string): Observable<FiscalPeriod> {
    return this.http.put<FiscalPeriod>(`${this.API_URL}/periods/${periodId}/reopen`, {});
  }

  deletePeriod(periodId: string): Observable<{ id: string; name: string }> {
    return this.http.delete<{ id: string; name: string }>(`${this.API_URL}/periods/${periodId}`);
  }

  listJournalEntries(params?: {
    q?: string;
    status?: JournalEntryStatus;
    periodId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Observable<JournalEntrySummary[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.status) query.set('status', params.status);
    if (params?.periodId) query.set('periodId', params.periodId);
    if (params?.fromDate) query.set('fromDate', params.fromDate);
    if (params?.toDate) query.set('toDate', params.toDate);
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    return this.http.get<JournalEntrySummary[]>(`${this.API_URL}/journal-entries${suffix ? `?${suffix}` : ''}`);
  }

  getJournalEntry(entryId: string): Observable<JournalEntryDetail> {
    return this.http.get<JournalEntryDetail>(`${this.API_URL}/journal-entries/${entryId}`);
  }

  createJournalEntry(payload: {
    date?: string;
    description: string;
    reference?: string;
    currency?: CurrencyCode;
    exchangeRateUsdToCup?: number;
    periodId?: string;
    sourceType?: string;
    sourceId?: string;
    status?: JournalEntryStatus;
    lines: JournalEntryLine[];
  }): Observable<JournalEntryDetail> {
    return this.http.post<JournalEntryDetail>(`${this.API_URL}/journal-entries`, payload);
  }

  postJournalEntry(entryId: string): Observable<JournalEntryDetail> {
    return this.http.put<JournalEntryDetail>(`${this.API_URL}/journal-entries/${entryId}/post`, {});
  }

  voidJournalEntry(entryId: string, reason?: string): Observable<JournalEntryDetail> {
    return this.http.put<JournalEntryDetail>(`${this.API_URL}/journal-entries/${entryId}/void`, { reason });
  }

  getJournalReport(params?: {
    periodId?: string;
    fromDate?: string;
    toDate?: string;
    includeDraft?: boolean;
    includeVoid?: boolean;
    limit?: number;
  }): Observable<AccountingJournalReport> {
    const query = this.buildReportQuery(params);
    return this.http.get<AccountingJournalReport>(`${this.API_URL}/reports/journal${query}`);
  }

  getLedgerReport(accountId: string, params?: {
    periodId?: string;
    fromDate?: string;
    toDate?: string;
    includeDraft?: boolean;
    includeVoid?: boolean;
    limit?: number;
  }): Observable<AccountingLedgerReport> {
    const query = this.buildReportQuery(params);
    return this.http.get<AccountingLedgerReport>(`${this.API_URL}/reports/ledger/${accountId}${query}`);
  }

  getTrialBalanceReport(params?: {
    periodId?: string;
    fromDate?: string;
    toDate?: string;
    includeDraft?: boolean;
    includeVoid?: boolean;
    limit?: number;
  }): Observable<AccountingTrialBalanceReport> {
    const query = this.buildReportQuery(params);
    return this.http.get<AccountingTrialBalanceReport>(`${this.API_URL}/reports/trial-balance${query}`);
  }

  private buildReportQuery(params?: {
    periodId?: string;
    fromDate?: string;
    toDate?: string;
    includeDraft?: boolean;
    includeVoid?: boolean;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.periodId) query.set('periodId', params.periodId);
    if (params?.fromDate) query.set('fromDate', params.fromDate);
    if (params?.toDate) query.set('toDate', params.toDate);
    if (params?.includeDraft === true) query.set('includeDraft', 'true');
    if (params?.includeVoid === true) query.set('includeVoid', 'true');
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    return suffix ? `?${suffix}` : '';
  }
}
