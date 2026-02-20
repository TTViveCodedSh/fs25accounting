import { useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { getLoans, createLoan, recordLoanPayment, getLoanPayments, getCurrentPeriod, createTransaction } from '@/db/queries'
import { persistDatabase } from '@/db/database'
import { formatCurrency, formatPercent, formatDate, todayISO } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Plus, CreditCard, Banknote, ChevronDown, ChevronUp } from 'lucide-react'

export function Loans() {
  const { db, refresh } = useDatabase()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [repayDialogOpen, setRepayDialogOpen] = useState(false)
  const [repayLoanId, setRepayLoanId] = useState<number | null>(null)
  const [repayAmount, setRepayAmount] = useState('')
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null)

  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [interestRate, setInterestRate] = useState('4')
  const [startDate, setStartDate] = useState(todayISO())

  const loans = getLoans(db)
  const currentPeriod = getCurrentPeriod(db)
  const activeLoans = loans.filter((l) => l.status === 'active')
  const paidLoans = loans.filter((l) => l.status === 'paid_off')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPeriod) return
    const p = parseFloat(principal)
    const ir = parseFloat(interestRate)
    if (!name || isNaN(p) || isNaN(ir)) return

    // monthly_payment stored as 0 — interest is computed dynamically
    createLoan(db, name, p, ir, 0, startDate)

    await persistDatabase()
    refresh()
    setDialogOpen(false)
    setName('')
    setPrincipal('')
    setInterestRate('4')
    setStartDate(todayISO())
  }

  async function handlePayInterest(loanId: number) {
    if (!currentPeriod) return
    const loan = loans.find((l) => l.id === loanId)
    if (!loan) return

    const monthlyRate = loan.interest_rate / 100 / 12
    const interestPart = Math.round(loan.remaining_balance * monthlyRate)
    if (interestPart <= 0) return

    // Record payment: interest only, no principal
    recordLoanPayment(db, loanId, currentPeriod.id, interestPart, 0, interestPart, todayISO())

    // Record interest as expense
    const catResult = db.exec(`SELECT id FROM category WHERE name = 'Loan Interest'`)
    const catId = catResult[0]?.values[0]?.[0] as number | undefined
    createTransaction(db, currentPeriod.id, todayISO(), `Interest: ${loan.name}`, interestPart, 'expense', catId ?? null, null)

    await persistDatabase()
    refresh()
  }

  function openRepayDialog(loanId: number) {
    setRepayLoanId(loanId)
    setRepayAmount('')
    setRepayDialogOpen(true)
  }

  async function handleRepayCapital(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPeriod || !repayLoanId) return
    const loan = loans.find((l) => l.id === repayLoanId)
    if (!loan) return

    const amount = parseFloat(repayAmount)
    if (isNaN(amount) || amount <= 0) return

    // Clamp to remaining balance
    const actual = Math.min(amount, loan.remaining_balance)

    // Record payment: principal only, no interest
    recordLoanPayment(db, repayLoanId, currentPeriod.id, actual, actual, 0, todayISO())

    await persistDatabase()
    refresh()
    setRepayDialogOpen(false)
    setRepayLoanId(null)
  }

  function getMonthlyInterest(loan: typeof loans[0]): number {
    return Math.round(loan.remaining_balance * loan.interest_rate / 100 / 12)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        <Button onClick={() => setDialogOpen(true)} disabled={!currentPeriod}>
          <Plus className="h-4 w-4" /> New Loan
        </Button>
      </div>

      {activeLoans.length === 0 && (
        <div className="text-muted-foreground text-sm">No active loans</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeLoans.map((loan) => {
          const paidOff = loan.principal - loan.remaining_balance
          const progressPct = (paidOff / loan.principal) * 100
          const monthlyInterest = getMonthlyInterest(loan)
          const payments = expandedLoan === loan.id ? getLoanPayments(db, loan.id) : []

          return (
            <Card key={loan.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{loan.name}</CardTitle>
                  <Badge variant="outline">{formatPercent(loan.interest_rate)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial Principal</span>
                  <span className="font-medium">{formatCurrency(loan.principal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining Balance</span>
                  <span className="font-bold text-red-600">{formatCurrency(loan.remaining_balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Interest</span>
                  <span className="font-medium">{formatCurrency(monthlyInterest)}</span>
                </div>
                <Progress value={progressPct} indicatorClassName="bg-green-500" />
                <div className="text-xs text-muted-foreground text-right">
                  {formatCurrency(paidOff)} repaid out of {formatCurrency(loan.principal)}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handlePayInterest(loan.id)} disabled={!currentPeriod}>
                    <CreditCard className="h-4 w-4" /> Pay Interest
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openRepayDialog(loan.id)} disabled={!currentPeriod}>
                    <Banknote className="h-4 w-4" /> Repay Capital
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                  >
                    {expandedLoan === loan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Details
                  </Button>
                </div>
                {expandedLoan === loan.id && payments.length > 0 && (
                  <div className="mt-2 text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-1 text-left">Date</th>
                          <th className="pb-1 text-right">Amount</th>
                          <th className="pb-1 text-right">Capital</th>
                          <th className="pb-1 text-right">Interest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} className="border-b">
                            <td className="py-1">{formatDate(p.date)}</td>
                            <td className="py-1 text-right">{formatCurrency(p.amount)}</td>
                            <td className="py-1 text-right">{p.principal_part > 0 ? formatCurrency(p.principal_part) : '—'}</td>
                            <td className="py-1 text-right">{p.interest_part > 0 ? formatCurrency(p.interest_part) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {paidLoans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Paid Off Loans</h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-right">Principal</th>
                    <th className="p-3 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {paidLoans.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="p-3">{l.name}</td>
                      <td className="p-3 text-right">{formatCurrency(l.principal)}</td>
                      <td className="p-3 text-right">{formatPercent(l.interest_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* New Loan dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>New Loan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g.: Bank loan" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Borrowed Amount</Label>
              <Input type="number" step="0.01" min="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Annual Rate (%)</Label>
              <Input type="number" step="0.01" min="0" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
              {principal && interestRate && (
                <div className="text-xs text-muted-foreground">
                  ~ {formatCurrency(Math.round(parseFloat(principal) * parseFloat(interestRate) / 100 / 12))}/month interest
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>

      {/* Repay Capital dialog */}
      <Dialog open={repayDialogOpen} onOpenChange={setRepayDialogOpen}>
        <DialogHeader>
          <DialogTitle>Repay Capital</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleRepayCapital} className="space-y-4">
          {repayLoanId && (() => {
            const loan = loans.find((l) => l.id === repayLoanId)
            if (!loan) return null
            return (
              <div className="text-sm space-y-1">
                <div><strong>{loan.name}</strong></div>
                <div>Remaining balance: {formatCurrency(loan.remaining_balance)}</div>
              </div>
            )
          })()}
          <div className="space-y-2">
            <Label>Amount to repay</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRepayDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Repay</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
