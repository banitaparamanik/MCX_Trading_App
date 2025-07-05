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
    console.log(`🚀 Fetching MCX data for ${commodity} - ${expiry}`)

    try {
      const url = `${this.baseUrl}?commodity=${encodeURIComponent(commodity)}&expiry=${encodeURIComponent(expiry)}`
      console.log(`📡 API URL: ${url}`)

      const res = await fetch(url, { cache: "no-store" })
      console.log(`📊 API Response Status: ${res.status}`)

      if (!res.ok) {
        console.warn(`❌ Proxy API failed with status ${res.status}`)
        const errorText = await res.text()
        console.warn(`❌ Error response: ${errorText}`)
        this.alertSystem.addAlert(`MCX API failed (${res.status}) – using mock data.`, "warning")
        return generateMockData()
      }

      const response: MCXApiResponse = await res.json()
      console.log(`📦 API Response:`, {
        hasData: !!response.data,
        dataLength: response.data?.length || 0,
        underlyingValue: response.underlyingValue,
        hasError: !!response.error,
      })

      // Check for error in response
      if (response.error) {
        console.warn("❌ MCX API returned error:", response.error)
        this.alertSystem.addAlert(`MCX API error: ${response.error} – using mock data.`, "warning")
        return generateMockData()
      }

      if (!Array.isArray(response.data) || response.data.length === 0) {
        console.warn("❌ MCX API returned no data")
        this.alertSystem.addAlert(`MCX API returned no data – using mock data.`, "warning")
        return generateMockData()
      }

      // Store underlying value for analytics
      this.underlyingValue = response.underlyingValue || 5690

      console.log(`✅ Successfully loaded ${response.data.length} MCX records, Underlying: ₹${this.underlyingValue}`)
      this.alertSystem.addAlert(
        `✅ Live MCX data loaded! ${response.data.length} strikes, Underlying: ₹${this.underlyingValue}`,
        "info",
      )
      return response.data
    } catch (e) {
      console.error("❌ Client fetch error:", e)
      this.alertSystem.addAlert(
        `Network error: ${e instanceof Error ? e.message : "Unknown error"} – using mock data.`,
        "error",
      )
      return generateMockData()
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

