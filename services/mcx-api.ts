// MCX API Service
interface OptionChainData {
  STRIKE_PRICE: number
  PE_LTP: number
  PE_ABS_CHNG: number
  PE_PER_CHNG: number
  PE_VOLUME: number
  PE_OI: number
  PE_OI_CHNG: number
  PE_BID: number
  PE_ASK: number
  CE_LTP: number
  CE_ABS_CHNG: number
  CE_PER_CHNG: number
  CE_VOLUME: number
  CE_OI: number
  CE_OI_CHNG: number
  CE_BID: number
  CE_ASK: number
  PE_TURNOVER: number
  CE_TURNOVER: number
}

interface AnalyticsData {
  totalPEOI: number
  totalCEOI: number
  totalPEVolume: number
  totalCEVolume: number
  totalPETurnover: number
  totalCETurnover: number
  maxPEOI: number
  maxCEOI: number
  maxPEOIStrike: number
  maxCEOIStrike: number
  putCallRatio: number
  volumeRatio: number
  turnoverRatio: number
  avgPEAbsChange: number
  avgCEAbsChange: number
  marketSentiment: string
  timestamp: string
  underlyingValue?: number
}

interface MCXApiResponse {
  data: OptionChainData[]
  underlyingValue: number
  timestamp: string
  source: string
  error?: string // Add optional error property
}

class AlertSystem {
  private alerts: Array<{
    id: string
    message: string
    type: "info" | "warning" | "error"
    timestamp: Date
  }> = []

  addAlert(message: string, type: "info" | "warning" | "error" = "info") {
    this.alerts.push({
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date(),
    })
  }

  getAlerts() {
    return this.alerts
  }

  clearAlerts() {
    this.alerts = []
  }
}

function generateMockData(): OptionChainData[] {
  const strikes = [4800, 4900, 5000, 5100, 5200, 5300, 5400, 5500, 5600, 5700, 5800]

  return strikes.map((strike) => ({
    STRIKE_PRICE: strike,
    PE_LTP: Math.random() * 100 + 50,
    PE_ABS_CHNG: (Math.random() - 0.5) * 20,
    PE_PER_CHNG: (Math.random() - 0.5) * 10,
    PE_VOLUME: Math.floor(Math.random() * 10000) + 1000,
    PE_OI: Math.floor(Math.random() * 50000) + 5000,
    PE_OI_CHNG: Math.floor((Math.random() - 0.5) * 5000),
    PE_BID: Math.random() * 100 + 45,
    PE_ASK: Math.random() * 100 + 55,
    CE_LTP: Math.random() * 100 + 50,
    CE_ABS_CHNG: (Math.random() - 0.5) * 20,
    CE_PER_CHNG: (Math.random() - 0.5) * 10,
    CE_VOLUME: Math.floor(Math.random() * 10000) + 1000,
    CE_OI: Math.floor(Math.random() * 50000) + 5000,
    CE_OI_CHNG: Math.floor((Math.random() - 0.5) * 5000),
    CE_BID: Math.random() * 100 + 45,
    CE_ASK: Math.random() * 100 + 55,
    PE_TURNOVER: Math.random() * 1000000 + 100000,
    CE_TURNOVER: Math.random() * 1000000 + 100000,
  }))
}

export class MCXApiService {
  private baseUrl = "/api/option-chain"
  private alertSystem = new AlertSystem()
  private underlyingValue = 5690 // Default value

  async fetchOptionChain(commodity = "CRUDEOIL", expiry = "17JUL2025"): Promise<OptionChainData[]> {
    console.log(`🚀 Fetching LIVE MCX data for ${commodity} - ${expiry}`)

    const url = `${this.baseUrl}?commodity=${encodeURIComponent(commodity)}&expiry=${encodeURIComponent(expiry)}`

    try {
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`MCX API failed with status ${res.status}: ${errorText}`)
      }

      const response: MCXApiResponse = await res.json()

      if (!response.data || response.data.length === 0) {
        throw new Error("MCX API returned empty data.")
      }

      this.underlyingValue = response.underlyingValue ?? this.underlyingValue
      return response.data
    } catch (error) {
      console.error("❌ LIVE API Fetch Error:", error)
      throw new Error("Failed to fetch live MCX data")
    }
  }


  calculateAnalytics(data: OptionChainData[]): AnalyticsData | null {
    if (!data.length) return null

    const totalPEOI = data.reduce((sum, item) => sum + (item.PE_OI || 0), 0)
    const totalCEOI = data.reduce((sum, item) => sum + (item.CE_OI || 0), 0)
    const totalPEVolume = data.reduce((sum, item) => sum + (item.PE_VOLUME || 0), 0)
    const totalCEVolume = data.reduce((sum, item) => sum + (item.CE_VOLUME || 0), 0)
    const totalPETurnover = data.reduce((sum, item) => sum + (item.PE_TURNOVER || 0), 0)
    const totalCETurnover = data.reduce((sum, item) => sum + (item.CE_TURNOVER || 0), 0)

    const maxPEOI = Math.max(...data.map((item) => item.PE_OI || 0))
    const maxCEOI = Math.max(...data.map((item) => item.CE_OI || 0))

    const maxPEOIStrike = data.find((item) => item.PE_OI === maxPEOI)?.STRIKE_PRICE || 0
    const maxCEOIStrike = data.find((item) => item.CE_OI === maxCEOI)?.STRIKE_PRICE || 0

    const putCallRatio = totalCEOI > 0 ? totalPEOI / totalCEOI : 0
    const volumeRatio = totalCEVolume > 0 ? totalPEVolume / totalCEVolume : 0
    const turnoverRatio = totalCETurnover > 0 ? totalPETurnover / totalCETurnover : 0

    const avgPEAbsChange = data.reduce((sum, item) => sum + (item.PE_ABS_CHNG || 0), 0) / data.length
    const avgCEAbsChange = data.reduce((sum, item) => sum + (item.CE_ABS_CHNG || 0), 0) / data.length

    return {
      totalPEOI,
      totalCEOI,
      totalPEVolume,
      totalCEVolume,
      totalPETurnover,
      totalCETurnover,
      maxPEOI,
      maxCEOI,
      maxPEOIStrike,
      maxCEOIStrike,
      putCallRatio,
      volumeRatio,
      turnoverRatio,
      avgPEAbsChange,
      avgCEAbsChange,
      marketSentiment: putCallRatio > 1 ? "Bearish" : "Bullish",
      timestamp: new Date().toISOString(),
      underlyingValue: this.underlyingValue,
    }
  }

  getUnderlyingValue(): number {
    return this.underlyingValue
  }

  getAlerts() {
    return this.alertSystem.getAlerts()
  }

  clearAlerts() {
    return this.alertSystem.clearAlerts()
  }
}

export type { AnalyticsData, OptionChainData }

