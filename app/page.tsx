"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Activity, AlertTriangle, BarChart3, Download } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"; // Import useCallback
import { MCXApiService, type AnalyticsData, type OptionChainData } from "../services/mcx-api"

interface PriceAlert {
  id: string
  symbol: string
  strike: number
  oldPrice: number
  newPrice: number
  changePercent: number
  timestamp: Date
}

interface AlertSettings {
  enabled: boolean
  threshold: number
  soundEnabled: boolean
}

export default function MCXTradingApp() {
  const [optionChainData, setOptionChainData] = useState<OptionChainData[]>([])
  const [historicalData, setHistoricalData] = useState<OptionChainData[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [isLive, setIsLive] = useState<boolean>(false)
  const [selectedCommodity, setSelectedCommodity] = useState<string>("CRUDEOIL")
  const [selectedExpiry, setSelectedExpiry] = useState<string>("17JUL2025")
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(300)
  const [isClient, setIsClient] = useState<boolean>(false)

  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    enabled: true,
    threshold: 5,
    soundEnabled: true,
  })

  const [autoDownloadSettings, setAutoDownloadSettings] = useState({
    enabled: true,
    recordThreshold: 500,
    lastDownloadCount: 0,
  })

  ///New State for lastAutoDownloadInfo:

  const [lastAutoDownloadInfo, ] = useState<{
  count: number;
  timestamp: Date;
} | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const mcxApiService = useRef<MCXApiService>(new MCXApiService())

  // Available commodities and expiries
  const commodities = ["CRUDEOIL", "GOLD", "SILVER", "COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"]
  const expiries = ["17JUL2025", "19AUG2025", "19SEP2025", "21OCT2025", "19NOV2025", "19DEC2025"]

  // Show alert notification
  // Wrapped in useCallback as it's called from checkForAlerts and passed to CriticalAlertModal
  const showAlert = useCallback(
    (alert: PriceAlert) => {
      if (!isClient || !alertSettings.enabled) {
        console.log("🔕 Alert blocked - disabled or not client")
        return
      }

      console.log("🔔 Showing alert:", alert)

      if (alertSettings.soundEnabled) {
        const audio = new Audio(
          "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
        )
        audio.play().catch(() => {})
      }
toast(
  <div>
    <div className="font-bold">🚨 Option Price Alert!</div>
    <div>
      {`${alert.symbol} ${alert.strike}: ₹${alert.oldPrice.toFixed(2)} → ₹${alert.newPrice.toFixed(2)} (${alert.changePercent.toFixed(2)}%)`}
    </div>
  </div>,
  { duration: 5000 }
)

      if (alert.changePercent > 10) {
        setShowAlertModal(true)
      }
    },
    [isClient, alertSettings.enabled, alertSettings.soundEnabled, toast],
  )

  // Check for price alerts
  // Wrapped in useCallback as it's called from fetchOptionChainData
  const checkForAlerts = useCallback(
    (newData: OptionChainData[]) => {
      // Early return if alerts are disabled, no client, or no previous data to compare
      // Use the current state of optionChainData via closure or pass it if it's the 'previous' state
      if (!alertSettings.enabled || !isClient || optionChainData.length === 0) {
        console.log("🔕 Alerts disabled or no previous data to compare")
        return
      }

      console.log("🔔 Checking for alerts...", {
        enabled: alertSettings.enabled,
        threshold: alertSettings.threshold,
        newDataLength: newData.length,
        oldDataLength: optionChainData.length,
      })

      let alertsTriggered = 0

      newData.forEach((newItem, index) => {
        const oldItem = optionChainData[index] // Access optionChainData from the closure
        if (!oldItem || oldItem.STRIKE_PRICE !== newItem.STRIKE_PRICE) return

        // Check PE alerts
        if (oldItem.PE_LTP > 0 && newItem.PE_LTP > 0) {
          const peChangePercent = Math.abs(((newItem.PE_LTP - oldItem.PE_LTP) / oldItem.PE_LTP) * 100)
          if (peChangePercent >= alertSettings.threshold) {
            const alert: PriceAlert = {
              id: `pe-alert-${Date.now()}-${Math.random()}`,
              symbol: `${selectedCommodity} PE`,
              strike: newItem.STRIKE_PRICE,
              oldPrice: oldItem.PE_LTP,
              newPrice: newItem.PE_LTP,
              changePercent: peChangePercent,
              timestamp: new Date(),
            }
            // Use functional update for setAlerts to get the latest state
            setAlerts((prev) => [alert, ...prev.slice(0, 19)])
            showAlert(alert)
            alertsTriggered++
            console.log("🚨 PE Alert triggered:", alert)
          }
        }

        // Check CE alerts
        if (oldItem.CE_LTP > 0 && newItem.CE_LTP > 0) {
          const ceChangePercent = Math.abs(((newItem.CE_LTP - oldItem.CE_LTP) / oldItem.CE_LTP) * 100)
          if (ceChangePercent >= alertSettings.threshold) {
            const alert: PriceAlert = {
              id: `ce-alert-${Date.now()}-${Math.random()}`,
              symbol: `${selectedCommodity} CE`,
              strike: newItem.STRIKE_PRICE,
              oldPrice: oldItem.CE_LTP,
              newPrice: newItem.CE_LTP,
              changePercent: ceChangePercent,
              timestamp: new Date(),
            }
            // Use functional update for setAlerts to get the latest state
            setAlerts((prev) => [alert, ...prev.slice(0, 19)])
            showAlert(alert)
            alertsTriggered++
            console.log("🚨 CE Alert triggered:", alert)
          }
        }
      })

      console.log(`✅ Alert check complete. ${alertsTriggered} alerts triggered.`)
    },
    [alertSettings.enabled, alertSettings.threshold, isClient, optionChainData, selectedCommodity, showAlert],
  )

  // Auto Download function
  // Wrapped in useCallback as it's called from fetchOptionChainData
const performAutoDownload = useCallback(async (currentRecordCount: number) => {
  if (!isClient || !autoDownloadSettings.enabled) return

  console.log(`📥 Performing auto-download with ${currentRecordCount} records`)

  const currentTime = new Date()
  const headers = ["Commodity", "Expiry", "Strike Price", "PE LTP", "CE LTP"]

  const csvContent = [
    headers.join(","),
    ...historicalData.map((row) =>
      ["CRUDEOIL", "17JUL2025", row.STRIKE_PRICE, row.PE_LTP, row.CE_LTP].join(",")
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `MCX_AUTO_CRUDEOIL_17JUL2025_${currentTime.toISOString().split("T")[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)

  setAutoDownloadSettings((prev) => ({
    ...prev,
    lastDownloadCount: currentRecordCount,
  }))

toast(
  <div>
    <div className="font-bold">
      🔄 Auto-Download Complete
    </div>
    <div>
      {`MCX data automatically exported at ${currentRecordCount} records`}
    </div>
  </div>,
  { duration: 5000 }
)

}, [isClient, autoDownloadSettings.enabled, historicalData, toast])


    const isDataChanged = (oldData: OptionChainData[], newData: OptionChainData[]): boolean => {
    if (oldData.length !== newData.length) return true

    for (let i = 0; i < newData.length; i++) {
      if (
        oldData[i].STRIKE_PRICE !== newData[i].STRIKE_PRICE ||
        oldData[i].PE_LTP !== newData[i].PE_LTP ||
        oldData[i].CE_LTP !== newData[i].CE_LTP
      ) {
        return true
      }
    }
    return false
  }

  // Fetch option chain data
  // Wrapped in useCallback as it's called on mount, expiry/commodity change, and intervals
 

const fetchOptionChainData = useCallback(async () => {
  if (!isClient) return

  try {
    const data = await mcxApiService.current.fetchOptionChain("CRUDEOIL", "17JUL2025")

    if (isDataChanged(optionChainData, data)) {
      console.log("✅ New data detected. Adding to historical records.")
     checkForAlerts(data)
      setOptionChainData(data)
   // Calculate analytics
      const analyticsData = mcxApiService.current.calculateAnalytics(data)
      setAnalytics(analyticsData)
      setHistoricalData((prev) => {
        const updatedHistoricalData = [...prev, ...data]

        if (
          autoDownloadSettings.enabled &&
          updatedHistoricalData.length >= autoDownloadSettings.recordThreshold &&
          updatedHistoricalData.length > autoDownloadSettings.lastDownloadCount
        ) {
          console.log(`🔄 Auto-download triggered: ${updatedHistoricalData.length} records reached`)

          setTimeout(() => {
            performAutoDownload(updatedHistoricalData.length)
          }, 1000)
        }

        return updatedHistoricalData
      })
    } else {
      console.log("⚠️ No data change detected. Skipping storage.")
    }
  } catch (error) {
    console.error("Error fetching option chain:", error)
    if (isClient) {
toast(
  <div>
    <div className="font-bold">
      Error
    </div>
    <div>
      Failed to fetch option chain data.
    </div>
  </div>
)
   
    }
  }
}, [isClient, optionChainData, autoDownloadSettings, performAutoDownload, toast, checkForAlerts])

// Include all external dependencies here

  // Auto refresh function
  // Wrapped in useCallback as it's used in setInterval
  const performAutoRefresh = useCallback(async () => {
    if (!isClient) return

    await fetchOptionChainData()
    setLastRefreshTime(new Date())
    setNextRefreshIn(300)
toast(
  <div>
    <div className="font-bold">
      🔄 Auto Refresh Complete
    </div>
    <div>
      Option chain data has been refreshed.
    </div>
  </div>,
  { duration: 3000 }
)
   
  }, [isClient, fetchOptionChainData, toast]) // Dependencies: isClient, fetchOptionChainData

  // Toggle auto refresh
  // Wrapped in useCallback as it's an event handler
  const toggleAutoRefresh = useCallback(() => {
    if (!isClient) return

    if (autoRefresh) {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      setAutoRefresh(false)
    } else {
      setAutoRefresh(true)
      setNextRefreshIn(300)

      autoRefreshIntervalRef.current = setInterval(performAutoRefresh, 300000)
      countdownIntervalRef.current = setInterval(() => {
        setNextRefreshIn((prev) => {
          if (prev <= 1) {
            return 300
          }
          return prev - 1
        })
      }, 1000)
    }
  }, [autoRefresh, isClient, performAutoRefresh]) // Dependencies: autoRefresh, isClient, performAutoRefresh

  const formatCountdown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // Toggle live updates
  // Wrapped in useCallback as it's an event handler
  const toggleLiveUpdates = useCallback(() => {
    if (!isClient) return

    if (isLive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsLive(false)
    } else {
      intervalRef.current = setInterval(fetchOptionChainData, 10000) // Update every 10 seconds
      setIsLive(true)
    }
  }, [isClient, isLive, fetchOptionChainData]) // Dependencies: isClient, isLive, fetchOptionChainData

  // Download CSV function - MCX Option Chain Format
  // Wrapped in useCallback as it's an event handler
  const downloadCSV = useCallback(() => {
    if (!isClient) return

    // MCX-style headers matching the table structure
    const headers = [
      "Commodity",
      "Expiry",
      "Underlying Price",
      "Strike Price",
      // PUT OPTIONS
      "PE OI",
      "PE Volume",
      "PE LTP",
      "PE Abs Change",
      "PE % Change",
      "PE Bid",
      "PE Ask",
      "PE Turnover",
      // CALL OPTIONS
      "CE Bid",
      "CE Ask",
      "CE Abs Change",
      "CE % Change",
      "CE LTP",
      "CE Volume",
      "CE OI",
      "CE Turnover",
      // META DATA
      "Timestamp",
      "Data Source",
    ]

    // Get current underlying value
    // Access current analytics state via closure
    const underlyingValue = analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()
    const currentTime = new Date()

    // Use historical data (all collected records) instead of just current optionChainData
    // Access historicalData and optionChainData from the closure
    const dataToExport = historicalData.length > 0 ? historicalData.slice(0, 1000) : optionChainData

    const csvContent = [
      // Header row
      headers.join(","),

      // Data rows - using historical data with timestamps
      ...dataToExport.map((row, index) => {
        // Create timestamp for each record (spread over time for historical data)
        const recordTime = new Date(currentTime.getTime() - index * 60000) // 1 minute intervals

        return [
          selectedCommodity,
          selectedExpiry,
          underlyingValue.toFixed(2),
          row.STRIKE_PRICE,
          // PUT OPTIONS
          row.PE_OI?.toLocaleString() || 0,
          row.PE_VOLUME?.toLocaleString() || 0,
          row.PE_LTP?.toFixed(2) || 0,
          row.PE_ABS_CHNG?.toFixed(2) || 0,
          row.PE_PER_CHNG?.toFixed(2) || 0,
          row.PE_BID?.toFixed(2) || 0,
          row.PE_ASK?.toFixed(2) || 0,
          row.PE_TURNOVER?.toFixed(2) || 0,
          // CALL OPTIONS
          row.CE_BID?.toFixed(2) || 0,
          row.CE_ASK?.toFixed(2) || 0,
          row.CE_ABS_CHNG?.toFixed(2) || 0,
          row.CE_PER_CHNG?.toFixed(2) || 0,
          row.CE_LTP?.toFixed(2) || 0,
          row.CE_VOLUME?.toLocaleString() || 0,
          row.CE_OI?.toLocaleString() || 0,
          row.CE_TURNOVER?.toFixed(2) || 0,
          // META DATA
          recordTime.toLocaleString(),
          "MCX Live API",
        ].join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `MCX_${selectedCommodity}_${selectedExpiry}_${currentTime.toISOString().split("T")[0]}_${currentTime.toTimeString().split(" ")[0].replace(/:/g, "")}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
toast(
  <div>
    <div className="font-bold">
      📊 MCX Data Export Complete
    </div>
    <div>
      {`${dataToExport.length} historical records exported in MCX format`}
    </div>
  </div>,
  { duration: 3000 }
)
 
  }, [isClient, analytics, historicalData, optionChainData, selectedCommodity, selectedExpiry, toast]) // Dependencies

  // Initialize client-side rendering
  // The useEffect for initial data fetch and cleanup remains largely the same,
  // but it now depends on fetchOptionChainData which is a useCallback.
  useEffect(() => {
    setIsClient(true)
    setLastRefreshTime(new Date())
    fetchOptionChainData()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [fetchOptionChainData]) // Dependency: fetchOptionChainData (which is memoized)

  // Fetch data when commodity or expiry changes
  useEffect(() => {
    if (isClient) {
      fetchOptionChainData()
    }
  }, [selectedCommodity, selectedExpiry, isClient, fetchOptionChainData]) // Dependency: fetchOptionChainData

  // Market Analytics Panel
  const AnalyticsPanel = () => {
    if (!analytics || !isClient) return null

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Market Analytics - {selectedCommodity}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Underlying Price</p>
              <p className="text-3xl font-bold text-blue-600">
                ₹{analytics.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
              </p>
              <Badge variant="outline" className="mt-1">
                {selectedCommodity}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Put Call Ratio</p>
              <p className="text-2xl font-bold">{analytics.putCallRatio.toFixed(2)}</p>
              <Badge variant={analytics.marketSentiment === "Bullish" ? "default" : "destructive"}>
                {analytics.marketSentiment}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Max PE OI</p>
              <p className="text-2xl font-bold">{analytics.maxPEOIStrike}</p>
              <p className="text-sm text-gray-600">{analytics.maxPEOI.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Max CE OI</p>
              <p className="text-2xl font-bold">{analytics.maxCEOIStrike}</p>
              <p className="text-sm text-gray-600">{analytics.maxCEOI.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Volume</p>
              <p className="text-lg font-bold">
                {(analytics.totalPEVolume + analytics.totalCEVolume).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">PE: {analytics.totalPEVolume.toLocaleString()}</p>
              <p className="text-sm text-gray-600">CE: {analytics.totalCEVolume.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Control Panel
  const ControlPanel = () => (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          MCX Option Chain Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Commodity:</label>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              {commodities.map((commodity) => (
                <option key={commodity} value={commodity}>
                  {commodity}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Expiry:</label>
            <select
              value={selectedExpiry}
              onChange={(e) => setSelectedExpiry(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              {expiries.map((expiry) => (
                <option key={expiry} value={expiry}>
                  {expiry}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={fetchOptionChainData} variant="outline">
            Fetch Data
          </Button>

          <Button
            onClick={toggleLiveUpdates}
            variant={isLive ? "destructive" : "default"}
            className="flex items-center gap-2"
          >
            {isLive ? "Stop Live Updates" : "Start Live Updates (10s)"}
            {isLive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              onClick={toggleAutoRefresh}
              variant={autoRefresh ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              {autoRefresh ? "Stop Auto Refresh" : "Start Auto Refresh (5min)"}
            </Button>
            {autoRefresh && (
              <span className="text-sm text-gray-700">Next refresh in: {formatCountdown(nextRefreshIn)}</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="alertEnabled"
              checked={alertSettings.enabled}
              onChange={(e) => {
                const enabled = e.target.checked
                setAlertSettings((prev) => ({ ...prev, enabled }))
                console.log("🔔 Alerts", enabled ? "ENABLED" : "DISABLED")
                toast(
  <div>
    <div className="font-bold">
      {enabled ? "🔔 Alerts Enabled" : "🔕 Alerts Disabled"}
    </div>
    <div>
      {enabled
        ? `Price alerts will trigger at ${alertSettings.threshold}% change`
        : "No price alerts will be shown"}
    </div>
  </div>,
  { duration: 3000 }
)
              }}
              className="rounded"
            />
            <label htmlFor="alertEnabled" className="text-sm font-medium">
              Enable Alerts
            </label>
            {alertSettings.enabled && (
              <Badge variant="default" className="ml-2">
                Active
              </Badge>
            )}
            {!alertSettings.enabled && (
              <Badge variant="secondary" className="ml-2">
                Disabled
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <label htmlFor="threshold" className="text-sm font-medium">
              Alert Threshold:
            </label>
            <input
              type="number"
              id="threshold"
              min="1"
              max="50"
              step="1"
              value={alertSettings.threshold}
              onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold: Number.parseInt(e.target.value) }))}
              className="w-20 px-2 py-1 border rounded text-sm"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="soundEnabled"
              checked={alertSettings.soundEnabled}
              onChange={(e) => setAlertSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
              disabled={!alertSettings.enabled}
              className="rounded"
            />
            <label htmlFor="soundEnabled" className="text-sm font-medium">
              Sound Alerts
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoDownloadEnabled"
              checked={autoDownloadSettings.enabled}
              onChange={(e) => {
                const enabled = e.target.checked
                setAutoDownloadSettings((prev) => ({ ...prev, enabled }))
                console.log("📥 Auto-download", enabled ? "ENABLED" : "DISABLED")
                toast(
  <div>
    <div className="font-bold">
      
enabled ? 📥 Auto-Download Enabled: 📥 Auto-Download Disabled,
    </div>
    <div>
      enabled
        ? <div>
  {`CSV will auto-download at ${autoDownloadSettings.recordThreshold} records`}
</div>
        : Auto-download has been disabled
    </div>
  </div>,
  { duration: 3000 }
)
            
              }}
              className="rounded"
            />
            <label htmlFor="autoDownloadEnabled" className="text-sm font-medium">
              Auto-Download CSV
            </label>
            {autoDownloadSettings.enabled && (
              <Badge variant="default" className="ml-2">
                @{autoDownloadSettings.recordThreshold}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <label htmlFor="downloadThreshold" className="text-sm font-medium">
              Download at:
            </label>
            <input
              type="number"
              id="downloadThreshold"
              min="100"
              max="1000"
              step="50"
              value={autoDownloadSettings.recordThreshold}
              onChange={(e) =>
                setAutoDownloadSettings((prev) => ({
                  ...prev,
                  recordThreshold: Number.parseInt(e.target.value),
                }))
              }
              disabled={!autoDownloadSettings.enabled}
              className="w-20 px-2 py-1 border rounded text-sm"
            />
            <span className="text-sm text-gray-500">records</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Market Status Card
  const MarketStatusCard = () => (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            Market Status - {selectedCommodity}
          </div>
          <Badge variant={isLive ? "default" : "secondary"}>{isLive ? "LIVE" : "STATIC"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-500">Current Price</p>
            <p className="text-4xl font-bold text-blue-600">
              ₹{analytics?.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Last Updated</p>
            {isClient && lastRefreshTime ? (
              <>
                <p className="text-lg font-semibold">{lastRefreshTime.toLocaleTimeString()}</p>
                <p className="text-sm text-gray-500">{lastRefreshTime.toLocaleDateString()}</p>
              </>
            ) : (
              <p className="text-lg font-semibold">Loading...</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Total Records</p>
            <p className="text-2xl font-bold">{optionChainData.length}</p>
            <p className="text-sm text-gray-500">Option Strikes</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Data Source</p>
            <p className="text-lg font-semibold text-green-600">MCX Live</p>
            <p className="text-sm text-gray-500">Real-time</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Critical Alert Modal
  const CriticalAlertModal = () => {
    if (!showAlertModal || !isClient || !alertSettings.enabled) return null

    const latestAlert = alerts[0]
    if (!latestAlert) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-2">CRITICAL OPTION ALERT!</h2>
            <div className="space-y-2 mb-6">
              <p className="text-lg font-semibold">{latestAlert.symbol}</p>
              <p className="text-gray-600">Strike: {latestAlert.strike}</p>
              <p className="text-gray-600">
                Price: ₹{latestAlert.oldPrice.toFixed(2)} → ₹{latestAlert.newPrice.toFixed(2)}
              </p>
              <p className={`text-lg font-bold ${latestAlert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                {latestAlert.changePercent.toFixed(2)}% Change
              </p>
              <p className="text-sm text-gray-500">{latestAlert.timestamp.toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowAlertModal(false)} className="flex-1">
                Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAlertSettings((prev) => ({ ...prev, enabled: false }))
                  setShowAlertModal(false)
                  toast(
                    <div>
                      <div className="font-bold">
                        🔕 Alerts Disabled
                      </div>
                      <div>
                   All price alerts have been disabled,
                         </div>
                    </div>,
               { duration: 3000 }
              )
              ;
                }}
                className="flex-1"
              >
                Disable Alerts
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state during hydration
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-full mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
          </div>
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-lg font-semibold">Loading MCX Data...</p>
                <p className="text-sm text-gray-500">Initializing trading dashboard</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
          <div className="flex gap-4">
            <Button onClick={downloadCSV} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download CSV
            </Button>
          </div>
        </div>

        {/* Control Panel */}
        <ControlPanel />

        {/* Market Status Card */}
        <MarketStatusCard />

        {/* Analytics Panel */}
        <AnalyticsPanel />

        {/* Critical Alert Modal */}
        <CriticalAlertModal />

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Recent Option Alerts ({alerts.length})
                </div>
                <Button variant="outline" size="sm" onClick={() => setAlerts([])}>
                  Clear All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts.slice(0, 10).map((alert) => (
                  <Alert
                    key={alert.id}
                    className={`border-red-200 ${Math.abs(alert.changePercent) > 10 ? "bg-red-50" : ""}`}
                  >
                    <AlertDescription>
                      <div className="flex justify-between items-center">
                        <div>
                          <strong>{alert.symbol}</strong> Strike {alert.strike}: ₹{alert.oldPrice.toFixed(2)} → ₹
                          {alert.newPrice.toFixed(2)}
                          <span
                            className={`ml-2 font-semibold ${alert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            ({alert.changePercent.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Option Chain Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              MCX Option Chain - {selectedCommodity} ({selectedExpiry})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center" colSpan={5}>
                      PUT OPTIONS
                    </TableHead>
                    <TableHead className="text-center font-bold">STRIKE</TableHead>
                    <TableHead className="text-center" colSpan={5}>
                      CALL OPTIONS
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead>OI</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>LTP</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Bid/Ask</TableHead>
                    <TableHead className="text-center font-bold">PRICE</TableHead>
                    <TableHead>Bid/Ask</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>LTP</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>OI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {optionChainData.map((item) => (
                    <TableRow key={item.STRIKE_PRICE}>
                      {/* PUT OPTIONS */}
                      <TableCell className="text-blue-600">{item.PE_OI?.toLocaleString() || 0}</TableCell>
                      <TableCell>{item.PE_VOLUME?.toLocaleString() || 0}</TableCell>
                      <TableCell className="font-bold">₹{item.PE_LTP?.toFixed(2) || 0}</TableCell>
                      <TableCell className={item.PE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
                        <div className="font-semibold">
                          {item.PE_ABS_CHNG >= 0 ? "+" : ""}
                          {item.PE_ABS_CHNG?.toFixed(2) || 0}
                        </div>
                        <div className="text-xs">
                          ({item.PE_PER_CHNG >= 0 ? "+" : ""}
                          {item.PE_PER_CHNG?.toFixed(2) || 0}%)
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.PE_BID?.toFixed(2) || 0} / {item.PE_ASK?.toFixed(2) || 0}
                      </TableCell>

                      {/* STRIKE PRICE - Highlight ATM strikes */}
                      <TableCell
                        className={`text-center font-bold text-lg ${
                          Math.abs(
                            item.STRIKE_PRICE -
                              (analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()),
                          ) <= 100
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100"
                        }`}
                      >
                        {item.STRIKE_PRICE}
                      </TableCell>

                      {/* CALL OPTIONS */}
                      <TableCell className="text-xs">
                        {item.CE_BID?.toFixed(2) || 0} / {item.CE_ASK?.toFixed(2) || 0}
                      </TableCell>
                      <TableCell className={item.CE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
                        <div className="font-semibold">
                          {item.CE_ABS_CHNG >= 0 ? "+" : ""}
                          {item.CE_ABS_CHNG?.toFixed(2) || 0}
                        </div>
                        <div className="text-xs">
                          ({item.CE_PER_CHNG >= 0 ? "+" : ""}
                          {item.CE_PER_CHNG?.toFixed(2) || 0}%)
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">₹{item.CE_LTP?.toFixed(2) || 0}</TableCell>
                      <TableCell>{item.CE_VOLUME?.toLocaleString() || 0}</TableCell>
                      <TableCell className="text-red-600">{item.CE_OI?.toLocaleString() || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Historical Data Summary */}
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Historical Data Summary ({historicalData.length} records)</span>
              <div className="flex items-center gap-2">
                {autoDownloadSettings.enabled && (
                  <Badge variant="outline" className="text-xs">
                    Auto-download: {" "}
                    {autoDownloadSettings.recordThreshold - historicalData.length > 0
                      ? `${autoDownloadSettings.recordThreshold - historicalData.length} records remaining`
                      : "Ready to download"}
                  </Badge>
                )}
                <Badge
                  variant={historicalData.length >= autoDownloadSettings.recordThreshold ? "destructive" : "secondary"}
                >
                  {historicalData.length >= autoDownloadSettings.recordThreshold ? "Threshold Reached" : "Collecting"}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Current Records</p>
                <p className="text-2xl font-bold">{historicalData.length}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Auto-Download Threshold</p>
                <p className="text-2xl font-bold text-blue-600">{autoDownloadSettings.recordThreshold}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Last Auto-Download</p>
                {lastAutoDownloadInfo ? (
                  <>
                    <p className="text-lg font-semibold">{lastAutoDownloadInfo.count} records</p>
                    <p className="text-sm text-gray-500">{lastAutoDownloadInfo.timestamp.toLocaleTimeString()}</p>
                  </>
                ) : (
                  <p className="text-lg font-semibold">Not yet triggered</p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    historicalData.length >= autoDownloadSettings.recordThreshold ? "bg-red-500" : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.min((historicalData.length / autoDownloadSettings.recordThreshold) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Progress: {historicalData.length}/{autoDownloadSettings.recordThreshold} records
                {autoDownloadSettings.enabled &&
                  historicalData.length >= autoDownloadSettings.recordThreshold &&
                  " - Auto-download will trigger on next data fetch"}
              </p>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Historical option chain data is being collected.
              {autoDownloadSettings.enabled
                ? ` Auto-download will trigger at ${autoDownloadSettings.recordThreshold} records.`
                : " Use the Download CSV button to export manually."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

///CSV CSV WORKING PERFECTLY 
// "use client"

// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { useToast } from "@/hooks/use-toast"
// import { Activity, AlertTriangle, BarChart3, Download } from "lucide-react"
// import { useEffect, useRef, useState } from "react"
// import { MCXApiService, type AnalyticsData, type OptionChainData } from "../services/mcx-api"

// interface PriceAlert {
//   id: string
//   symbol: string
//   strike: number
//   oldPrice: number
//   newPrice: number
//   changePercent: number
//   timestamp: Date
// }

// interface AlertSettings {
//   enabled: boolean
//   threshold: number
//   soundEnabled: boolean
// }

// export default function MCXTradingApp() {
//   const [optionChainData, setOptionChainData] = useState<OptionChainData[]>([])
//   const [historicalData, setHistoricalData] = useState<OptionChainData[]>([])
//   const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
//   const [alerts, setAlerts] = useState<PriceAlert[]>([])
//   const [isLive, setIsLive] = useState<boolean>(false)
//   const [selectedCommodity, setSelectedCommodity] = useState<string>("CRUDEOIL")
//   const [selectedExpiry, setSelectedExpiry] = useState<string>("17JUL2025")
//   const [showAlertModal, setShowAlertModal] = useState<boolean>(false)
//   const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
//   const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
//   const [nextRefreshIn, setNextRefreshIn] = useState<number>(300)
//   const [isClient, setIsClient] = useState<boolean>(false)

//   const [alertSettings, setAlertSettings] = useState<AlertSettings>({
//     enabled: true,
//     threshold: 5,
//     soundEnabled: true,
//   })

//   const [autoDownloadSettings, setAutoDownloadSettings] = useState({
//     enabled: true,
//     recordThreshold: 400,
//     lastDownloadCount: 0,
//   })

//   const intervalRef = useRef<NodeJS.Timeout | null>(null)
//   const { toast } = useToast()

//   const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

//   const mcxApiService = useRef<MCXApiService>(new MCXApiService())

//   // Available commodities and expiries
//   const commodities = ["CRUDEOIL", "GOLD", "SILVER", "COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"]
//   const expiries = ["17JUL2025", "19AUG2025", "19SEP2025", "21OCT2025", "19NOV2025", "19DEC2025"]

//   // Initialize client-side rendering
//   useEffect(() => {
//     setIsClient(true)
//     setLastRefreshTime(new Date())
//     fetchOptionChainData()

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//     }
//   }, [])

//   // Fetch data when commodity or expiry changes
//   useEffect(() => {
//     if (isClient) {
//       fetchOptionChainData()
//     }
//   }, [selectedCommodity, selectedExpiry, isClient])

//   // Fetch option chain data
//   const fetchOptionChainData = async () => {
//     if (!isClient) return

//     try {
//       const data = await mcxApiService.current.fetchOptionChain(selectedCommodity, selectedExpiry)
//       setOptionChainData(data)

//       // Calculate analytics
//       const analyticsData = mcxApiService.current.calculateAnalytics(data)
//       setAnalytics(analyticsData)

//       // Add to historical data
//       setHistoricalData((prev) => {
//         const newHistoricalData = [...data, ...prev.slice(0, 500)] // Keep last 500 records

//         // Check for auto-download trigger
//         if (
//           autoDownloadSettings.enabled &&
//           newHistoricalData.length >= autoDownloadSettings.recordThreshold &&
//           newHistoricalData.length > autoDownloadSettings.lastDownloadCount
//         ) {
//           console.log(`🔄 Auto-download triggered: ${newHistoricalData.length} records reached`)

//           // Trigger auto download
//           setTimeout(() => {
//             performAutoDownload(newHistoricalData.length)
//           }, 1000) // Small delay to ensure state is updated
//         }

//         return newHistoricalData
//       })

//       // Check for alerts
//       checkForAlerts(data)
//     } catch (error) {
//       console.error("Error fetching option chain:", error)
//       if (isClient) {
//         toast({
//           title: "Error",
//           description: "Failed to fetch option chain data. Using mock data.",
//           variant: "destructive",
//         })
//       }
//     }
//   }

//   // Check for price alerts
//   const checkForAlerts = (newData: OptionChainData[]) => {
//     // Early return if alerts are disabled, no client, or no previous data to compare
//     if (!alertSettings.enabled || !isClient || optionChainData.length === 0) {
//       console.log("🔕 Alerts disabled or no previous data to compare")
//       return
//     }

//     console.log("🔔 Checking for alerts...", {
//       enabled: alertSettings.enabled,
//       threshold: alertSettings.threshold,
//       newDataLength: newData.length,
//       oldDataLength: optionChainData.length,
//     })

//     let alertsTriggered = 0

//     newData.forEach((newItem, index) => {
//       const oldItem = optionChainData[index]
//       if (!oldItem || oldItem.STRIKE_PRICE !== newItem.STRIKE_PRICE) return

//       // Check PE alerts
//       if (oldItem.PE_LTP > 0 && newItem.PE_LTP > 0) {
//         const peChangePercent = Math.abs(((newItem.PE_LTP - oldItem.PE_LTP) / oldItem.PE_LTP) * 100)
//         if (peChangePercent >= alertSettings.threshold) {
//           const alert: PriceAlert = {
//             id: `pe-alert-${Date.now()}-${Math.random()}`,
//             symbol: `${selectedCommodity} PE`,
//             strike: newItem.STRIKE_PRICE,
//             oldPrice: oldItem.PE_LTP,
//             newPrice: newItem.PE_LTP,
//             changePercent: peChangePercent,
//             timestamp: new Date(),
//           }
//           setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//           showAlert(alert)
//           alertsTriggered++
//           console.log("🚨 PE Alert triggered:", alert)
//         }
//       }

//       // Check CE alerts
//       if (oldItem.CE_LTP > 0 && newItem.CE_LTP > 0) {
//         const ceChangePercent = Math.abs(((newItem.CE_LTP - oldItem.CE_LTP) / oldItem.CE_LTP) * 100)
//         if (ceChangePercent >= alertSettings.threshold) {
//           const alert: PriceAlert = {
//             id: `ce-alert-${Date.now()}-${Math.random()}`,
//             symbol: `${selectedCommodity} CE`,
//             strike: newItem.STRIKE_PRICE,
//             oldPrice: oldItem.CE_LTP,
//             newPrice: newItem.CE_LTP,
//             changePercent: ceChangePercent,
//             timestamp: new Date(),
//           }
//           setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//           showAlert(alert)
//           alertsTriggered++
//           console.log("🚨 CE Alert triggered:", alert)
//         }
//       }
//     })

//     console.log(`✅ Alert check complete. ${alertsTriggered} alerts triggered.`)
//   }

//   // Show alert notification
//   const showAlert = (alert: PriceAlert) => {
//     if (!isClient || !alertSettings.enabled) {
//       console.log("🔕 Alert blocked - disabled or not client")
//       return
//     }

//     console.log("🔔 Showing alert:", alert)

//     if (alertSettings.soundEnabled) {
//       const audio = new Audio(
//         "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
//       )
//       audio.play().catch(() => {})
//     }

//     toast({
//       title: "🚨 Option Price Alert!",
//       description: `${alert.symbol} ${alert.strike}: ₹${alert.oldPrice.toFixed(2)} → ₹${alert.newPrice.toFixed(2)} (${alert.changePercent.toFixed(2)}%)`,
//       variant: "destructive",
//       duration: 5000,
//     })

//     if (alert.changePercent > 10) {
//       setShowAlertModal(true)
//     }
//   }

//   // Auto refresh function
//   const performAutoRefresh = async () => {
//     if (!isClient) return

//     await fetchOptionChainData()
//     setLastRefreshTime(new Date())
//     setNextRefreshIn(300)

//     toast({
//       title: "🔄 Auto Refresh Complete",
//       description: "Option chain data has been refreshed.",
//       duration: 3000,
//     })
//   }

//   // Toggle auto refresh
//   const toggleAutoRefresh = () => {
//     if (!isClient) return

//     if (autoRefresh) {
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//       setAutoRefresh(false)
//     } else {
//       setAutoRefresh(true)
//       setNextRefreshIn(300)

//       autoRefreshIntervalRef.current = setInterval(performAutoRefresh, 300000)
//       countdownIntervalRef.current = setInterval(() => {
//         setNextRefreshIn((prev) => {
//           if (prev <= 1) {
//             return 300
//           }
//           return prev - 1
//         })
//       }, 1000)
//     }
//   }

//   const formatCountdown = (seconds: number): string => {
//     const minutes = Math.floor(seconds / 60)
//     const remainingSeconds = seconds % 60
//     return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
//   }

//   const toggleLiveUpdates = () => {
//     if (!isClient) return

//     if (isLive) {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       setIsLive(false)
//     } else {
//       intervalRef.current = setInterval(fetchOptionChainData, 10000) // Update every 10 seconds
//       setIsLive(true)
//     }
//   }

//   // Download CSV function - MCX Option Chain Format
//   const downloadCSV = () => {
//     if (!isClient) return

//     // MCX-style headers matching the table structure
//     const headers = [
//       "Commodity",
//       "Expiry",
//       "Underlying Price",
//       "Strike Price",
//       // PUT OPTIONS
//       "PE OI",
//       "PE Volume",
//       "PE LTP",
//       "PE Abs Change",
//       "PE % Change",
//       "PE Bid",
//       "PE Ask",
//       "PE Turnover",
//       // CALL OPTIONS
//       "CE Bid",
//       "CE Ask",
//       "CE Abs Change",
//       "CE % Change",
//       "CE LTP",
//       "CE Volume",
//       "CE OI",
//       "CE Turnover",
//       // META DATA
//       "Timestamp",
//       "Data Source",
//     ]

//     // Get current underlying value
//     const underlyingValue = analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()
//     const currentTime = new Date()

//     const csvContent = [
//       // Header row
//       headers.join(","),

//       // Data rows - using current option chain data (most recent)
//       ...optionChainData.map((row) =>
//         [
//           selectedCommodity,
//           selectedExpiry,
//           underlyingValue.toFixed(2),
//           row.STRIKE_PRICE,
//           // PUT OPTIONS
//           row.PE_OI?.toLocaleString() || 0,
//           row.PE_VOLUME?.toLocaleString() || 0,
//           row.PE_LTP?.toFixed(2) || 0,
//           row.PE_ABS_CHNG?.toFixed(2) || 0,
//           row.PE_PER_CHNG?.toFixed(2) || 0,
//           row.PE_BID?.toFixed(2) || 0,
//           row.PE_ASK?.toFixed(2) || 0,
//           row.PE_TURNOVER?.toFixed(2) || 0,
//           // CALL OPTIONS
//           row.CE_BID?.toFixed(2) || 0,
//           row.CE_ASK?.toFixed(2) || 0,
//           row.CE_ABS_CHNG?.toFixed(2) || 0,
//           row.CE_PER_CHNG?.toFixed(2) || 0,
//           row.CE_LTP?.toFixed(2) || 0,
//           row.CE_VOLUME?.toLocaleString() || 0,
//           row.CE_OI?.toLocaleString() || 0,
//           row.CE_TURNOVER?.toFixed(2) || 0,
//           // META DATA
//           currentTime.toLocaleString(),
//           "MCX Live API",
//         ].join(","),
//       ),
//     ].join("\n")

//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
//     const url = window.URL.createObjectURL(blob)
//     const a = document.createElement("a")
//     a.href = url
//     a.download = `MCX_${selectedCommodity}_${selectedExpiry}_${currentTime.toISOString().split("T")[0]}_${currentTime.toTimeString().split(" ")[0].replace(/:/g, "")}.csv`
//     document.body.appendChild(a)
//     a.click()
//     document.body.removeChild(a)
//     window.URL.revokeObjectURL(url)

//     toast({
//       title: "📊 MCX Data Export Complete",
//       description: `${optionChainData.length} option strikes exported in MCX format`,
//       duration: 4000,
//     })
//   }

//   // Auto Download function
//   const performAutoDownload = (currentRecordCount: number) => {
//     if (!isClient || !autoDownloadSettings.enabled) return

//     console.log(`📥 Performing auto-download with ${currentRecordCount} records`)

//     // Get current underlying value
//     const underlyingValue = analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()
//     const currentTime = new Date()

//     // MCX-style headers matching the table structure
//     const headers = [
//       "Commodity",
//       "Expiry",
//       "Underlying Price",
//       "Strike Price",
//       // PUT OPTIONS
//       "PE OI",
//       "PE Volume",
//       "PE LTP",
//       "PE Abs Change",
//       "PE % Change",
//       "PE Bid",
//       "PE Ask",
//       "PE Turnover",
//       // CALL OPTIONS
//       "CE Bid",
//       "CE Ask",
//       "CE Abs Change",
//       "CE % Change",
//       "CE LTP",
//       "CE Volume",
//       "CE OI",
//       "CE Turnover",
//       // META DATA
//       "Timestamp",
//       "Data Source",
//     ]

//     const csvContent = [
//       // Header row
//       headers.join(","),

//       // Data rows - using current option chain data (most recent)
//       ...optionChainData.map((row) =>
//         [
//           selectedCommodity,
//           selectedExpiry,
//           underlyingValue.toFixed(2),
//           row.STRIKE_PRICE,
//           // PUT OPTIONS
//           row.PE_OI?.toLocaleString() || 0,
//           row.PE_VOLUME?.toLocaleString() || 0,
//           row.PE_LTP?.toFixed(2) || 0,
//           row.PE_ABS_CHNG?.toFixed(2) || 0,
//           row.PE_PER_CHNG?.toFixed(2) || 0,
//           row.PE_BID?.toFixed(2) || 0,
//           row.PE_ASK?.toFixed(2) || 0,
//           row.PE_TURNOVER?.toFixed(2) || 0,
//           // CALL OPTIONS
//           row.CE_BID?.toFixed(2) || 0,
//           row.CE_ASK?.toFixed(2) || 0,
//           row.CE_ABS_CHNG?.toFixed(2) || 0,
//           row.CE_PER_CHNG?.toFixed(2) || 0,
//           row.CE_LTP?.toFixed(2) || 0,
//           row.CE_VOLUME?.toLocaleString() || 0,
//           row.CE_OI?.toLocaleString() || 0,
//           row.CE_TURNOVER?.toFixed(2) || 0,
//           // META DATA
//           currentTime.toLocaleString(),
//           "MCX Live API",
//         ].join(","),
//       ),
//     ].join("\n")

//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
//     const url = window.URL.createObjectURL(blob)
//     const a = document.createElement("a")
//     a.href = url
//     a.download = `MCX_AUTO_${selectedCommodity}_${selectedExpiry}_${currentTime.toISOString().split("T")[0]}_${currentTime.toTimeString().split(" ")[0].replace(/:/g, "")}.csv`
//     document.body.appendChild(a)
//     a.click()
//     document.body.removeChild(a)
//     window.URL.revokeObjectURL(url)

//     // Update last download count
//     setAutoDownloadSettings((prev) => ({
//       ...prev,
//       lastDownloadCount: currentRecordCount,
//     }))

//     toast({
//       title: "🔄 Auto-Download Complete",
//       description: `MCX data automatically exported at ${currentRecordCount} records`,
//       duration: 5000,
//     })
//   }

//   // Market Analytics Panel
//   const AnalyticsPanel = () => {
//     if (!analytics || !isClient) return null

//     return (
//       <Card className="mb-4">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <BarChart3 className="w-5 h-5" />
//             Market Analytics - {selectedCommodity}
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Underlying Price</p>
//               <p className="text-3xl font-bold text-blue-600">
//                 ₹{analytics.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//               </p>
//               <Badge variant="outline" className="mt-1">
//                 {selectedCommodity}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Put Call Ratio</p>
//               <p className="text-2xl font-bold">{analytics.putCallRatio.toFixed(2)}</p>
//               <Badge variant={analytics.marketSentiment === "Bullish" ? "default" : "destructive"}>
//                 {analytics.marketSentiment}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max PE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxPEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxPEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max CE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxCEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxCEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Total Volume</p>
//               <p className="text-lg font-bold">
//                 {(analytics.totalPEVolume + analytics.totalCEVolume).toLocaleString()}
//               </p>
//               <p className="text-sm text-gray-600">PE: {analytics.totalPEVolume.toLocaleString()}</p>
//               <p className="text-sm text-gray-600">CE: {analytics.totalCEVolume.toLocaleString()}</p>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     )
//   }

//   // Control Panel
//   const ControlPanel = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Activity className="w-5 h-5" />
//           MCX Option Chain Controls
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="flex flex-wrap gap-4 items-center">
//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Commodity:</label>
//             <select
//               value={selectedCommodity}
//               onChange={(e) => setSelectedCommodity(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {commodities.map((commodity) => (
//                 <option key={commodity} value={commodity}>
//                   {commodity}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Expiry:</label>
//             <select
//               value={selectedExpiry}
//               onChange={(e) => setSelectedExpiry(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {expiries.map((expiry) => (
//                 <option key={expiry} value={expiry}>
//                   {expiry}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <Button onClick={fetchOptionChainData} variant="outline">
//             Fetch Data
//           </Button>

//           <Button
//             onClick={toggleLiveUpdates}
//             variant={isLive ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {isLive ? "Stop Live Updates" : "Start Live Updates (10s)"}
//             {isLive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
//           </Button>

//           <Button
//             onClick={toggleAutoRefresh}
//             variant={autoRefresh ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {autoRefresh ? "Stop Auto Refresh" : "Start Auto Refresh (5min)"}
//           </Button>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="alertEnabled"
//               checked={alertSettings.enabled}
//               onChange={(e) => {
//                 const enabled = e.target.checked
//                 setAlertSettings((prev) => ({ ...prev, enabled }))
//                 console.log("🔔 Alerts", enabled ? "ENABLED" : "DISABLED")
//                 toast({
//                   title: enabled ? "🔔 Alerts Enabled" : "🔕 Alerts Disabled",
//                   description: enabled
//                     ? `Price alerts will trigger at ${alertSettings.threshold}% change`
//                     : "No price alerts will be shown",
//                   duration: 3000,
//                 })
//               }}
//               className="rounded"
//             />
//             <label htmlFor="alertEnabled" className="text-sm font-medium">
//               Enable Alerts
//             </label>
//             {alertSettings.enabled && (
//               <Badge variant="default" className="ml-2">
//                 Active
//               </Badge>
//             )}
//             {!alertSettings.enabled && (
//               <Badge variant="secondary" className="ml-2">
//                 Disabled
//               </Badge>
//             )}
//           </div>

//           <div className="flex items-center space-x-2">
//             <label htmlFor="threshold" className="text-sm font-medium">
//               Alert Threshold:
//             </label>
//             <input
//               type="number"
//               id="threshold"
//               min="1"
//               max="50"
//               step="1"
//               value={alertSettings.threshold}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold: Number.parseInt(e.target.value) }))}
//               className="w-20 px-2 py-1 border rounded text-sm"
//             />
//             <span className="text-sm text-gray-500">%</span>
//           </div>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="soundEnabled"
//               checked={alertSettings.soundEnabled}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
//               disabled={!alertSettings.enabled}
//               className="rounded"
//             />
//             <label htmlFor="soundEnabled" className="text-sm font-medium">
//               Sound Alerts
//             </label>
//           </div>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="autoDownloadEnabled"
//               checked={autoDownloadSettings.enabled}
//               onChange={(e) => {
//                 const enabled = e.target.checked
//                 setAutoDownloadSettings((prev) => ({ ...prev, enabled }))
//                 console.log("📥 Auto-download", enabled ? "ENABLED" : "DISABLED")
//                 toast({
//                   title: enabled ? "📥 Auto-Download Enabled" : "📥 Auto-Download Disabled",
//                   description: enabled
//                     ? `CSV will auto-download at ${autoDownloadSettings.recordThreshold} records`
//                     : "Auto-download has been disabled",
//                   duration: 3000,
//                 })
//               }}
//               className="rounded"
//             />
//             <label htmlFor="autoDownloadEnabled" className="text-sm font-medium">
//               Auto-Download CSV
//             </label>
//             {autoDownloadSettings.enabled && (
//               <Badge variant="default" className="ml-2">
//                 @{autoDownloadSettings.recordThreshold}
//               </Badge>
//             )}
//           </div>

//           <div className="flex items-center space-x-2">
//             <label htmlFor="downloadThreshold" className="text-sm font-medium">
//               Download at:
//             </label>
//             <input
//               type="number"
//               id="downloadThreshold"
//               min="100"
//               max="1000"
//               step="50"
//               value={autoDownloadSettings.recordThreshold}
//               onChange={(e) =>
//                 setAutoDownloadSettings((prev) => ({
//                   ...prev,
//                   recordThreshold: Number.parseInt(e.target.value),
//                 }))
//               }
//               disabled={!autoDownloadSettings.enabled}
//               className="w-20 px-2 py-1 border rounded text-sm"
//             />
//             <span className="text-sm text-gray-500">records</span>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Market Status Card
//   const MarketStatusCard = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <Activity className="w-5 h-5 text-green-500" />
//             Market Status - {selectedCommodity}
//           </div>
//           <Badge variant={isLive ? "default" : "secondary"}>{isLive ? "LIVE" : "STATIC"}</Badge>
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Current Price</p>
//             <p className="text-4xl font-bold text-blue-600">
//               ₹{analytics?.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//             </p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Last Updated</p>
//             {isClient && lastRefreshTime ? (
//               <>
//                 <p className="text-lg font-semibold">{lastRefreshTime.toLocaleTimeString()}</p>
//                 <p className="text-sm text-gray-500">{lastRefreshTime.toLocaleDateString()}</p>
//               </>
//             ) : (
//               <p className="text-lg font-semibold">Loading...</p>
//             )}
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Total Records</p>
//             <p className="text-2xl font-bold">{optionChainData.length}</p>
//             <p className="text-sm text-gray-500">Option Strikes</p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Data Source</p>
//             <p className="text-lg font-semibold text-green-600">MCX Live</p>
//             <p className="text-sm text-gray-500">Real-time</p>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Critical Alert Modal
//   const CriticalAlertModal = () => {
//     if (!showAlertModal || !isClient || !alertSettings.enabled) return null

//     const latestAlert = alerts[0]
//     if (!latestAlert) return null

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
//           <div className="text-center">
//             <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
//             <h2 className="text-2xl font-bold text-red-600 mb-2">CRITICAL OPTION ALERT!</h2>
//             <div className="space-y-2 mb-6">
//               <p className="text-lg font-semibold">{latestAlert.symbol}</p>
//               <p className="text-gray-600">Strike: {latestAlert.strike}</p>
//               <p className="text-gray-600">
//                 Price: ₹{latestAlert.oldPrice.toFixed(2)} → ₹{latestAlert.newPrice.toFixed(2)}
//               </p>
//               <p className={`text-lg font-bold ${latestAlert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
//                 {latestAlert.changePercent.toFixed(2)}% Change
//               </p>
//               <p className="text-sm text-gray-500">{latestAlert.timestamp.toLocaleString()}</p>
//             </div>
//             <div className="flex gap-2">
//               <Button onClick={() => setShowAlertModal(false)} className="flex-1">
//                 Acknowledge
//               </Button>
//               <Button
//                 variant="outline"
//                 onClick={() => {
//                   setAlertSettings((prev) => ({ ...prev, enabled: false }))
//                   setShowAlertModal(false)
//                   toast({
//                     title: "🔕 Alerts Disabled",
//                     description: "All price alerts have been disabled",
//                     duration: 3000,
//                   })
//                 }}
//                 className="flex-1"
//               >
//                 Disable Alerts
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   // Show loading state during hydration
//   if (!isClient) {
//     return (
//       <div className="min-h-screen bg-gray-50 p-4">
//         <div className="max-w-full mx-auto space-y-6">
//           <div className="flex justify-between items-center">
//             <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           </div>
//           <Card>
//             <CardContent className="flex items-center justify-center py-12">
//               <div className="text-center">
//                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//                 <p className="text-lg font-semibold">Loading MCX Data...</p>
//                 <p className="text-sm text-gray-500">Initializing trading dashboard</p>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 p-4">
//       <div className="max-w-full mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex justify-between items-center">
//           <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           <div className="flex gap-4">
//             <Button onClick={downloadCSV} className="flex items-center gap-2">
//               <Download className="w-4 h-4" />
//               Download CSV
//             </Button>
//           </div>
//         </div>

//         {/* Control Panel */}
//         <ControlPanel />

//         {/* Market Status Card */}
//         <MarketStatusCard />

//         {/* Analytics Panel */}
//         <AnalyticsPanel />

//         {/* Critical Alert Modal */}
//         <CriticalAlertModal />

//         {/* Alerts Section */}
//         {alerts.length > 0 && (
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <AlertTriangle className="w-5 h-5 text-red-500" />
//                   Recent Option Alerts ({alerts.length})
//                 </div>
//                 <Button variant="outline" size="sm" onClick={() => setAlerts([])}>
//                   Clear All
//                 </Button>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-2 max-h-60 overflow-y-auto">
//                 {alerts.slice(0, 10).map((alert) => (
//                   <Alert
//                     key={alert.id}
//                     className={`border-red-200 ${Math.abs(alert.changePercent) > 10 ? "bg-red-50" : ""}`}
//                   >
//                     <AlertDescription>
//                       <div className="flex justify-between items-center">
//                         <div>
//                           <strong>{alert.symbol}</strong> Strike {alert.strike}: ₹{alert.oldPrice.toFixed(2)} → ₹
//                           {alert.newPrice.toFixed(2)}
//                           <span
//                             className={`ml-2 font-semibold ${alert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
//                           >
//                             ({alert.changePercent.toFixed(2)}%)
//                           </span>
//                         </div>
//                         <div className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</div>
//                       </div>
//                     </AlertDescription>
//                   </Alert>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         )}

//         {/* Option Chain Table */}
//         <Card>
//           <CardHeader>
//             <CardTitle>
//               MCX Option Chain - {selectedCommodity} ({selectedExpiry})
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead className="text-center" colSpan={5}>
//                       PUT OPTIONS
//                     </TableHead>
//                     <TableHead className="text-center font-bold">STRIKE</TableHead>
//                     <TableHead className="text-center" colSpan={5}>
//                       CALL OPTIONS
//                     </TableHead>
//                   </TableRow>
//                   <TableRow>
//                     <TableHead>OI</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead className="text-center font-bold">PRICE</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>OI</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {optionChainData.map((item) => (
//                     <TableRow key={item.STRIKE_PRICE}>
//                       {/* PUT OPTIONS */}
//                       <TableCell className="text-blue-600">{item.PE_OI?.toLocaleString() || 0}</TableCell>
//                       <TableCell>{item.PE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="font-bold">₹{item.PE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell className={item.PE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.PE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.PE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.PE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.PE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="text-xs">
//                         {item.PE_BID?.toFixed(2) || 0} / {item.PE_ASK?.toFixed(2) || 0}
//                       </TableCell>

//                       {/* STRIKE PRICE - Highlight ATM strikes */}
//                       <TableCell
//                         className={`text-center font-bold text-lg ${
//                           Math.abs(
//                             item.STRIKE_PRICE -
//                               (analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()),
//                           ) <= 100
//                             ? "bg-yellow-100 text-yellow-800"
//                             : "bg-gray-100"
//                         }`}
//                       >
//                         {item.STRIKE_PRICE}
//                       </TableCell>

//                       {/* CALL OPTIONS */}
//                       <TableCell className="text-xs">
//                         {item.CE_BID?.toFixed(2) || 0} / {item.CE_ASK?.toFixed(2) || 0}
//                       </TableCell>
//                       <TableCell className={item.CE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.CE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.CE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.CE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.CE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="font-bold">₹{item.CE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell>{item.CE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="text-red-600">{item.CE_OI?.toLocaleString() || 0}</TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Historical Data Summary */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center justify-between">
//               <span>Historical Data Summary ({historicalData.length} records)</span>
//               <div className="flex items-center gap-2">
//                 {autoDownloadSettings.enabled && (
//                   <Badge variant="outline" className="text-xs">
//                     Auto-download:{" "}
//                     {autoDownloadSettings.recordThreshold - historicalData.length > 0
//                       ? `${autoDownloadSettings.recordThreshold - historicalData.length} records remaining`
//                       : "Ready to download"}
//                   </Badge>
//                 )}
//                 <Badge
//                   variant={historicalData.length >= autoDownloadSettings.recordThreshold ? "destructive" : "secondary"}
//                 >
//                   {historicalData.length >= autoDownloadSettings.recordThreshold ? "Threshold Reached" : "Collecting"}
//                 </Badge>
//               </div>
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div className="text-center">
//                 <p className="text-sm text-gray-500">Current Records</p>
//                 <p className="text-2xl font-bold">{historicalData.length}</p>
//               </div>
//               <div className="text-center">
//                 <p className="text-sm text-gray-500">Auto-Download Threshold</p>
//                 <p className="text-2xl font-bold text-blue-600">{autoDownloadSettings.recordThreshold}</p>
//               </div>
//               <div className="text-center">
//                 <p className="text-sm text-gray-500">Last Auto-Download</p>
//                 <p className="text-lg font-semibold">
//                   {autoDownloadSettings.lastDownloadCount > 0
//                     ? `${autoDownloadSettings.lastDownloadCount} records`
//                     : "Not yet triggered"}
//                 </p>
//               </div>
//             </div>
//             <div className="mt-4">
//               <div className="w-full bg-gray-200 rounded-full h-2">
//                 <div
//                   className={`h-2 rounded-full transition-all duration-300 ${
//                     historicalData.length >= autoDownloadSettings.recordThreshold ? "bg-red-500" : "bg-blue-500"
//                   }`}
//                   style={{
//                     width: `${Math.min((historicalData.length / autoDownloadSettings.recordThreshold) * 100, 100)}%`,
//                   }}
//                 ></div>
//               </div>
//               <p className="text-xs text-gray-500 mt-1">
//                 Progress: {historicalData.length}/{autoDownloadSettings.recordThreshold} records
//                 {autoDownloadSettings.enabled &&
//                   historicalData.length >= autoDownloadSettings.recordThreshold &&
//                   " - Auto-download will trigger on next data fetch"}
//               </p>
//             </div>
//             <p className="text-sm text-gray-600 mt-4">
//               Historical option chain data is being collected.
//               {autoDownloadSettings.enabled
//                 ? ` Auto-download will trigger at ${autoDownloadSettings.recordThreshold} records.`
//                 : " Use the Download CSV button to export manually."}
//             </p>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }


/// TODO CSV and MCX table data format are same and working fine

// "use client"

// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { useToast } from "@/hooks/use-toast"
// import { Activity, AlertTriangle, BarChart3, Download } from "lucide-react"
// import { useEffect, useRef, useState } from "react"
// import { MCXApiService, type AnalyticsData, type OptionChainData } from "../services/mcx-api"

// interface PriceAlert {
//   id: string
//   symbol: string
//   strike: number
//   oldPrice: number
//   newPrice: number
//   changePercent: number
//   timestamp: Date
// }

// interface AlertSettings {
//   enabled: boolean
//   threshold: number
//   soundEnabled: boolean
// }

// export default function MCXTradingApp() {
//   const [optionChainData, setOptionChainData] = useState<OptionChainData[]>([])
//   const [historicalData, setHistoricalData] = useState<OptionChainData[]>([])
//   const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
//   const [alerts, setAlerts] = useState<PriceAlert[]>([])
//   const [isLive, setIsLive] = useState<boolean>(false)
//   const [selectedCommodity, setSelectedCommodity] = useState<string>("CRUDEOIL")
//   const [selectedExpiry, setSelectedExpiry] = useState<string>("17JUL2025")
//   const [showAlertModal, setShowAlertModal] = useState<boolean>(false)
//   const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
//   const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
//   const [nextRefreshIn, setNextRefreshIn] = useState<number>(300)
//   const [isClient, setIsClient] = useState<boolean>(false)

//   const [alertSettings, setAlertSettings] = useState<AlertSettings>({
//     enabled: true,
//     threshold: 5,
//     soundEnabled: true,
//   })
//   const intervalRef = useRef<NodeJS.Timeout | null>(null)
//   const { toast } = useToast()

//   const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

//   const mcxApiService = useRef<MCXApiService>(new MCXApiService())

//   // Available commodities and expiries
//   const commodities = ["CRUDEOIL", "GOLD", "SILVER", "COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"]
//   const expiries = ["17JUL2025", "19AUG2025", "19SEP2025", "21OCT2025", "19NOV2025", "19DEC2025"]

//   // Initialize client-side rendering
//   useEffect(() => {
//     setIsClient(true)
//     setLastRefreshTime(new Date())
//     fetchOptionChainData()

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//     }
//   }, [])

//   // Fetch data when commodity or expiry changes
//   useEffect(() => {
//     if (isClient) {
//       fetchOptionChainData()
//     }
//   }, [selectedCommodity, selectedExpiry, isClient])

//   // Fetch option chain data
//   const fetchOptionChainData = async () => {
//     if (!isClient) return

//     try {
//       const data = await mcxApiService.current.fetchOptionChain(selectedCommodity, selectedExpiry)
//       setOptionChainData(data)

//       // Calculate analytics
//       const analyticsData = mcxApiService.current.calculateAnalytics(data)
//       setAnalytics(analyticsData)

//       // Add to historical data
//       setHistoricalData((prev) => [...data, ...prev.slice(0, 500)]) // Keep last 500 records

//       // Check for alerts
//       checkForAlerts(data)
//     } catch (error) {
//       console.error("Error fetching option chain:", error)
//       if (isClient) {
//         toast({
//           title: "Error",
//           description: "Failed to fetch option chain data. Using mock data.",
//           variant: "destructive",
//         })
//       }
//     }
//   }

//   // Check for price alerts
//   const checkForAlerts = (newData: OptionChainData[]) => {
//     // Early return if alerts are disabled, no client, or no previous data to compare
//     if (!alertSettings.enabled || !isClient || optionChainData.length === 0) {
//       console.log("🔕 Alerts disabled or no previous data to compare")
//       return
//     }

//     console.log("🔔 Checking for alerts...", {
//       enabled: alertSettings.enabled,
//       threshold: alertSettings.threshold,
//       newDataLength: newData.length,
//       oldDataLength: optionChainData.length,
//     })

//     let alertsTriggered = 0

//     newData.forEach((newItem, index) => {
//       const oldItem = optionChainData[index]
//       if (!oldItem || oldItem.STRIKE_PRICE !== newItem.STRIKE_PRICE) return

//       // Check PE alerts
//       if (oldItem.PE_LTP > 0 && newItem.PE_LTP > 0) {
//         const peChangePercent = Math.abs(((newItem.PE_LTP - oldItem.PE_LTP) / oldItem.PE_LTP) * 100)
//         if (peChangePercent >= alertSettings.threshold) {
//           const alert: PriceAlert = {
//             id: `pe-alert-${Date.now()}-${Math.random()}`,
//             symbol: `${selectedCommodity} PE`,
//             strike: newItem.STRIKE_PRICE,
//             oldPrice: oldItem.PE_LTP,
//             newPrice: newItem.PE_LTP,
//             changePercent: peChangePercent,
//             timestamp: new Date(),
//           }
//           setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//           showAlert(alert)
//           alertsTriggered++
//           console.log("🚨 PE Alert triggered:", alert)
//         }
//       }

//       // Check CE alerts
//       if (oldItem.CE_LTP > 0 && newItem.CE_LTP > 0) {
//         const ceChangePercent = Math.abs(((newItem.CE_LTP - oldItem.CE_LTP) / oldItem.CE_LTP) * 100)
//         if (ceChangePercent >= alertSettings.threshold) {
//           const alert: PriceAlert = {
//             id: `ce-alert-${Date.now()}-${Math.random()}`,
//             symbol: `${selectedCommodity} CE`,
//             strike: newItem.STRIKE_PRICE,
//             oldPrice: oldItem.CE_LTP,
//             newPrice: newItem.CE_LTP,
//             changePercent: ceChangePercent,
//             timestamp: new Date(),
//           }
//           setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//           showAlert(alert)
//           alertsTriggered++
//           console.log("🚨 CE Alert triggered:", alert)
//         }
//       }
//     })

//     console.log(`✅ Alert check complete. ${alertsTriggered} alerts triggered.`)
//   }

//   // Show alert notification
//   const showAlert = (alert: PriceAlert) => {
//     if (!isClient || !alertSettings.enabled) {
//       console.log("🔕 Alert blocked - disabled or not client")
//       return
//     }

//     console.log("🔔 Showing alert:", alert)

//     if (alertSettings.soundEnabled) {
//       const audio = new Audio(
//         "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
//       )
//       audio.play().catch(() => {})
//     }

//     toast({
//       title: "🚨 Option Price Alert!",
//       description: `${alert.symbol} ${alert.strike}: ₹${alert.oldPrice.toFixed(2)} → ₹${alert.newPrice.toFixed(2)} (${alert.changePercent.toFixed(2)}%)`,
//       variant: "destructive",
//       duration: 5000,
//     })

//     if (alert.changePercent > 10) {
//       setShowAlertModal(true)
//     }
//   }

//   // Auto refresh function
//   const performAutoRefresh = async () => {
//     if (!isClient) return

//     await fetchOptionChainData()
//     setLastRefreshTime(new Date())
//     setNextRefreshIn(300)

//     toast({
//       title: "🔄 Auto Refresh Complete",
//       description: "Option chain data has been refreshed.",
//       duration: 3000,
//     })
//   }

//   // Toggle auto refresh
//   const toggleAutoRefresh = () => {
//     if (!isClient) return

//     if (autoRefresh) {
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//       setAutoRefresh(false)
//     } else {
//       setAutoRefresh(true)
//       setNextRefreshIn(300)

//       autoRefreshIntervalRef.current = setInterval(performAutoRefresh, 300000)
//       countdownIntervalRef.current = setInterval(() => {
//         setNextRefreshIn((prev) => {
//           if (prev <= 1) {
//             return 300
//           }
//           return prev - 1
//         })
//       }, 1000)
//     }
//   }

//   const formatCountdown = (seconds: number): string => {
//     const minutes = Math.floor(seconds / 60)
//     const remainingSeconds = seconds % 60
//     return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
//   }

//   const toggleLiveUpdates = () => {
//     if (!isClient) return

//     if (isLive) {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       setIsLive(false)
//     } else {
//       intervalRef.current = setInterval(fetchOptionChainData, 10000) // Update every 10 seconds
//       setIsLive(true)
//     }
//   }

//   // Download CSV function - MCX Option Chain Format
//   const downloadCSV = () => {
//     if (!isClient) return

//     // MCX-style headers matching the table structure
//     const headers = [
//       "Commodity",
//       "Expiry",
//       "Underlying Price",
//       "Strike Price",
//       // PUT OPTIONS
//       "PE OI",
//       "PE Volume",
//       "PE LTP",
//       "PE Abs Change",
//       "PE % Change",
//       "PE Bid",
//       "PE Ask",
//       "PE Turnover",
//       // CALL OPTIONS
//       "CE Bid",
//       "CE Ask",
//       "CE Abs Change",
//       "CE % Change",
//       "CE LTP",
//       "CE Volume",
//       "CE OI",
//       "CE Turnover",
//       // META DATA
//       "Timestamp",
//       "Data Source",
//     ]

//     // Get current underlying value
//     const underlyingValue = analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()
//     const currentTime = new Date()

//     const csvContent = [
//       // Header row
//       headers.join(","),

//       // Data rows - using current option chain data (most recent)
//       ...optionChainData.map((row) =>
//         [
//           selectedCommodity,
//           selectedExpiry,
//           underlyingValue.toFixed(2),
//           row.STRIKE_PRICE,
//           // PUT OPTIONS
//           row.PE_OI?.toLocaleString() || 0,
//           row.PE_VOLUME?.toLocaleString() || 0,
//           row.PE_LTP?.toFixed(2) || 0,
//           row.PE_ABS_CHNG?.toFixed(2) || 0,
//           row.PE_PER_CHNG?.toFixed(2) || 0,
//           row.PE_BID?.toFixed(2) || 0,
//           row.PE_ASK?.toFixed(2) || 0,
//           row.PE_TURNOVER?.toFixed(2) || 0,
//           // CALL OPTIONS
//           row.CE_BID?.toFixed(2) || 0,
//           row.CE_ASK?.toFixed(2) || 0,
//           row.CE_ABS_CHNG?.toFixed(2) || 0,
//           row.CE_PER_CHNG?.toFixed(2) || 0,
//           row.CE_LTP?.toFixed(2) || 0,
//           row.CE_VOLUME?.toLocaleString() || 0,
//           row.CE_OI?.toLocaleString() || 0,
//           row.CE_TURNOVER?.toFixed(2) || 0,
//           // META DATA
//           currentTime.toLocaleString(),
//           "MCX Live API",
//         ].join(","),
//       ),
//     ].join("\n")

//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
//     const url = window.URL.createObjectURL(blob)
//     const a = document.createElement("a")
//     a.href = url
//     a.download = `MCX_${selectedCommodity}_${selectedExpiry}_${currentTime.toISOString().split("T")[0]}_${currentTime.toTimeString().split(" ")[0].replace(/:/g, "")}.csv`
//     document.body.appendChild(a)
//     a.click()
//     document.body.removeChild(a)
//     window.URL.revokeObjectURL(url)

//     toast({
//       title: "📊 MCX Data Export Complete",
//       description: `${optionChainData.length} option strikes exported in MCX format`,
//       duration: 4000,
//     })
//   }

//   // Market Analytics Panel
//   const AnalyticsPanel = () => {
//     if (!analytics || !isClient) return null

//     return (
//       <Card className="mb-4">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <BarChart3 className="w-5 h-5" />
//             Market Analytics - {selectedCommodity}
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Underlying Price</p>
//               <p className="text-3xl font-bold text-blue-600">
//                 ₹{analytics.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//               </p>
//               <Badge variant="outline" className="mt-1">
//                 {selectedCommodity}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Put Call Ratio</p>
//               <p className="text-2xl font-bold">{analytics.putCallRatio.toFixed(2)}</p>
//               <Badge variant={analytics.marketSentiment === "Bullish" ? "default" : "destructive"}>
//                 {analytics.marketSentiment}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max PE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxPEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxPEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max CE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxCEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxCEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Total Volume</p>
//               <p className="text-lg font-bold">
//                 {(analytics.totalPEVolume + analytics.totalCEVolume).toLocaleString()}
//               </p>
//               <p className="text-sm text-gray-600">PE: {analytics.totalPEVolume.toLocaleString()}</p>
//               <p className="text-sm text-gray-600">CE: {analytics.totalCEVolume.toLocaleString()}</p>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     )
//   }

//   // Control Panel
//   const ControlPanel = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Activity className="w-5 h-5" />
//           MCX Option Chain Controls
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="flex flex-wrap gap-4 items-center">
//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Commodity:</label>
//             <select
//               value={selectedCommodity}
//               onChange={(e) => setSelectedCommodity(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {commodities.map((commodity) => (
//                 <option key={commodity} value={commodity}>
//                   {commodity}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Expiry:</label>
//             <select
//               value={selectedExpiry}
//               onChange={(e) => setSelectedExpiry(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {expiries.map((expiry) => (
//                 <option key={expiry} value={expiry}>
//                   {expiry}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <Button onClick={fetchOptionChainData} variant="outline">
//             Fetch Data
//           </Button>

//           <Button
//             onClick={toggleLiveUpdates}
//             variant={isLive ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {isLive ? "Stop Live Updates" : "Start Live Updates (10s)"}
//             {isLive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
//           </Button>

//           <Button
//             onClick={toggleAutoRefresh}
//             variant={autoRefresh ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {autoRefresh ? "Stop Auto Refresh" : "Start Auto Refresh (5min)"}
//           </Button>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="alertEnabled"
//               checked={alertSettings.enabled}
//               onChange={(e) => {
//                 const enabled = e.target.checked
//                 setAlertSettings((prev) => ({ ...prev, enabled }))
//                 console.log("🔔 Alerts", enabled ? "ENABLED" : "DISABLED")
//                 toast({
//                   title: enabled ? "🔔 Alerts Enabled" : "🔕 Alerts Disabled",
//                   description: enabled
//                     ? `Price alerts will trigger at ${alertSettings.threshold}% change`
//                     : "No price alerts will be shown",
//                   duration: 3000,
//                 })
//               }}
//               className="rounded"
//             />
//             <label htmlFor="alertEnabled" className="text-sm font-medium">
//               Enable Alerts
//             </label>
//             {alertSettings.enabled && (
//               <Badge variant="default" className="ml-2">
//                 Active
//               </Badge>
//             )}
//             {!alertSettings.enabled && (
//               <Badge variant="secondary" className="ml-2">
//                 Disabled
//               </Badge>
//             )}
//           </div>

//           <div className="flex items-center space-x-2">
//             <label htmlFor="threshold" className="text-sm font-medium">
//               Alert Threshold:
//             </label>
//             <input
//               type="number"
//               id="threshold"
//               min="1"
//               max="50"
//               step="1"
//               value={alertSettings.threshold}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold: Number.parseInt(e.target.value) }))}
//               className="w-20 px-2 py-1 border rounded text-sm"
//             />
//             <span className="text-sm text-gray-500">%</span>
//           </div>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="soundEnabled"
//               checked={alertSettings.soundEnabled}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
//               disabled={!alertSettings.enabled}
//               className="rounded"
//             />
//             <label htmlFor="soundEnabled" className="text-sm font-medium">
//               Sound Alerts
//             </label>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Market Status Card
//   const MarketStatusCard = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <Activity className="w-5 h-5 text-green-500" />
//             Market Status - {selectedCommodity}
//           </div>
//           <Badge variant={isLive ? "default" : "secondary"}>{isLive ? "LIVE" : "STATIC"}</Badge>
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Current Price</p>
//             <p className="text-4xl font-bold text-blue-600">
//               ₹{analytics?.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//             </p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Last Updated</p>
//             {isClient && lastRefreshTime ? (
//               <>
//                 <p className="text-lg font-semibold">{lastRefreshTime.toLocaleTimeString()}</p>
//                 <p className="text-sm text-gray-500">{lastRefreshTime.toLocaleDateString()}</p>
//               </>
//             ) : (
//               <p className="text-lg font-semibold">Loading...</p>
//             )}
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Total Records</p>
//             <p className="text-2xl font-bold">{optionChainData.length}</p>
//             <p className="text-sm text-gray-500">Option Strikes</p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Data Source</p>
//             <p className="text-lg font-semibold text-green-600">MCX Live</p>
//             <p className="text-sm text-gray-500">Real-time</p>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Critical Alert Modal
//   const CriticalAlertModal = () => {
//     if (!showAlertModal || !isClient || !alertSettings.enabled) return null

//     const latestAlert = alerts[0]
//     if (!latestAlert) return null

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
//           <div className="text-center">
//             <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
//             <h2 className="text-2xl font-bold text-red-600 mb-2">CRITICAL OPTION ALERT!</h2>
//             <div className="space-y-2 mb-6">
//               <p className="text-lg font-semibold">{latestAlert.symbol}</p>
//               <p className="text-gray-600">Strike: {latestAlert.strike}</p>
//               <p className="text-gray-600">
//                 Price: ₹{latestAlert.oldPrice.toFixed(2)} → ₹{latestAlert.newPrice.toFixed(2)}
//               </p>
//               <p className={`text-lg font-bold ${latestAlert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
//                 {latestAlert.changePercent.toFixed(2)}% Change
//               </p>
//               <p className="text-sm text-gray-500">{latestAlert.timestamp.toLocaleString()}</p>
//             </div>
//             <div className="flex gap-2">
//               <Button onClick={() => setShowAlertModal(false)} className="flex-1">
//                 Acknowledge
//               </Button>
//               <Button
//                 variant="outline"
//                 onClick={() => {
//                   setAlertSettings((prev) => ({ ...prev, enabled: false }))
//                   setShowAlertModal(false)
//                   toast({
//                     title: "🔕 Alerts Disabled",
//                     description: "All price alerts have been disabled",
//                     duration: 3000,
//                   })
//                 }}
//                 className="flex-1"
//               >
//                 Disable Alerts
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   // Show loading state during hydration
//   if (!isClient) {
//     return (
//       <div className="min-h-screen bg-gray-50 p-4">
//         <div className="max-w-full mx-auto space-y-6">
//           <div className="flex justify-between items-center">
//             <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           </div>
//           <Card>
//             <CardContent className="flex items-center justify-center py-12">
//               <div className="text-center">
//                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//                 <p className="text-lg font-semibold">Loading MCX Data...</p>
//                 <p className="text-sm text-gray-500">Initializing trading dashboard</p>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 p-4">
//       <div className="max-w-full mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex justify-between items-center">
//           <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           <div className="flex gap-4">
//             <Button onClick={downloadCSV} className="flex items-center gap-2">
//               <Download className="w-4 h-4" />
//               Download CSV
//             </Button>
//           </div>
//         </div>

//         {/* Control Panel */}
//         <ControlPanel />

//         {/* Market Status Card */}
//         <MarketStatusCard />

//         {/* Analytics Panel */}
//         <AnalyticsPanel />

//         {/* Critical Alert Modal */}
//         <CriticalAlertModal />

//         {/* Alerts Section */}
//         {alerts.length > 0 && (
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <AlertTriangle className="w-5 h-5 text-red-500" />
//                   Recent Option Alerts ({alerts.length})
//                 </div>
//                 <Button variant="outline" size="sm" onClick={() => setAlerts([])}>
//                   Clear All
//                 </Button>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-2 max-h-60 overflow-y-auto">
//                 {alerts.slice(0, 10).map((alert) => (
//                   <Alert
//                     key={alert.id}
//                     className={`border-red-200 ${Math.abs(alert.changePercent) > 10 ? "bg-red-50" : ""}`}
//                   >
//                     <AlertDescription>
//                       <div className="flex justify-between items-center">
//                         <div>
//                           <strong>{alert.symbol}</strong> Strike {alert.strike}: ₹{alert.oldPrice.toFixed(2)} → ₹
//                           {alert.newPrice.toFixed(2)}
//                           <span
//                             className={`ml-2 font-semibold ${alert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
//                           >
//                             ({alert.changePercent.toFixed(2)}%)
//                           </span>
//                         </div>
//                         <div className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</div>
//                       </div>
//                     </AlertDescription>
//                   </Alert>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         )}

//         {/* Option Chain Table */}
//         <Card>
//           <CardHeader>
//             <CardTitle>
//               MCX Option Chain - {selectedCommodity} ({selectedExpiry})
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead className="text-center" colSpan={5}>
//                       PUT OPTIONS
//                     </TableHead>
//                     <TableHead className="text-center font-bold">STRIKE</TableHead>
//                     <TableHead className="text-center" colSpan={5}>
//                       CALL OPTIONS
//                     </TableHead>
//                   </TableRow>
//                   <TableRow>
//                     <TableHead>OI</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead className="text-center font-bold">PRICE</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>OI</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {optionChainData.map((item) => (
//                     <TableRow key={item.STRIKE_PRICE}>
//                       {/* PUT OPTIONS */}
//                       <TableCell className="text-blue-600">{item.PE_OI?.toLocaleString() || 0}</TableCell>
//                       <TableCell>{item.PE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="font-bold">₹{item.PE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell className={item.PE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.PE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.PE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.PE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.PE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="text-xs">
//                         {item.PE_BID?.toFixed(2) || 0} / {item.PE_ASK?.toFixed(2) || 0}
//                       </TableCell>

//                       {/* STRIKE PRICE - Highlight ATM strikes */}
//                       <TableCell
//                         className={`text-center font-bold text-lg ${
//                           Math.abs(
//                             item.STRIKE_PRICE -
//                               (analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()),
//                           ) <= 100
//                             ? "bg-yellow-100 text-yellow-800"
//                             : "bg-gray-100"
//                         }`}
//                       >
//                         {item.STRIKE_PRICE}
//                       </TableCell>

//                       {/* CALL OPTIONS */}
//                       <TableCell className="text-xs">
//                         {item.CE_BID?.toFixed(2) || 0} / {item.CE_ASK?.toFixed(2) || 0}
//                       </TableCell>
//                       <TableCell className={item.CE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.CE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.CE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.CE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.CE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="font-bold">₹{item.CE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell>{item.CE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="text-red-600">{item.CE_OI?.toLocaleString() || 0}</TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Historical Data Summary */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Historical Data Summary ({historicalData.length} records)</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-sm text-gray-600">
//               Historical option chain data is being collected. Use the Download CSV button to export all historical
//               records.
//             </p>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }
/// TODO - uncomment the following lines to enable/diable alert and functionality WORKING FINE
// "use client"

// import { useState, useEffect, useRef } from "react"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Download, AlertTriangle, Activity, BarChart3 } from "lucide-react"
// import { useToast } from "@/hooks/use-toast"
// import { MCXApiService, type OptionChainData, type AnalyticsData } from "../services/mcx-api"

// interface PriceAlert {
//   id: string
//   symbol: string
//   strike: number
//   oldPrice: number
//   newPrice: number
//   changePercent: number
//   timestamp: Date
// }

// interface AlertSettings {
//   enabled: boolean
//   threshold: number
//   soundEnabled: boolean
// }

// export default function MCXTradingApp() {
//   const [optionChainData, setOptionChainData] = useState<OptionChainData[]>([])
//   const [historicalData, setHistoricalData] = useState<OptionChainData[]>([])
//   const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
//   const [alerts, setAlerts] = useState<PriceAlert[]>([])
//   const [isLive, setIsLive] = useState<boolean>(false)
//   const [selectedCommodity, setSelectedCommodity] = useState<string>("CRUDEOIL")
//   const [selectedExpiry, setSelectedExpiry] = useState<string>("17JUL2025")
//   const [showAlertModal, setShowAlertModal] = useState<boolean>(false)
//   const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
//   const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
//   const [nextRefreshIn, setNextRefreshIn] = useState<number>(300)
//   const [isClient, setIsClient] = useState<boolean>(false)

//   const [alertSettings, setAlertSettings] = useState<AlertSettings>({
//     enabled: true,
//     threshold: 5,
//     soundEnabled: true,
//   })
//   const intervalRef = useRef<NodeJS.Timeout | null>(null)
//   const { toast } = useToast()

//   const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

//   const mcxApiService = useRef<MCXApiService>(new MCXApiService())

//   // Available commodities and expiries
//   const commodities = ["CRUDEOIL", "GOLD", "SILVER", "COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"]
//   const expiries = ["17JUL2025", "19AUG2025", "19SEP2025", "21OCT2025", "19NOV2025", "19DEC2025"]

//   // Initialize client-side rendering
//   useEffect(() => {
//     setIsClient(true)
//     setLastRefreshTime(new Date())
//     fetchOptionChainData()

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//     }
//   }, [])

//   // Fetch data when commodity or expiry changes
//   useEffect(() => {
//     if (isClient) {
//       fetchOptionChainData()
//     }
//   }, [selectedCommodity, selectedExpiry, isClient])

//   // Fetch option chain data
//   const fetchOptionChainData = async () => {
//     if (!isClient) return

//     try {
//       const data = await mcxApiService.current.fetchOptionChain(selectedCommodity, selectedExpiry)
//       setOptionChainData(data)

//       // Calculate analytics
//       const analyticsData = mcxApiService.current.calculateAnalytics(data)
//       setAnalytics(analyticsData)

//       // Add to historical data
//       setHistoricalData((prev) => [...data, ...prev.slice(0, 500)]) // Keep last 500 records

//       // Check for alerts
//       checkForAlerts(data)
//     } catch (error) {
//       console.error("Error fetching option chain:", error)
//       if (isClient) {
//         toast({
//           title: "Error",
//           description: "Failed to fetch option chain data. Using mock data.",
//           variant: "destructive",
//         })
//       }
//     }
//   }

//   // Check for price alerts
//   const checkForAlerts = (newData: OptionChainData[]) => {
//     // Early return if alerts are disabled, no client, or no previous data to compare
//     if (!alertSettings.enabled || !isClient || optionChainData.length === 0) {
//       console.log("🔕 Alerts disabled or no previous data to compare")
//       return
//     }

//     console.log("🔔 Checking for alerts...", {
//       enabled: alertSettings.enabled,
//       threshold: alertSettings.threshold,
//       newDataLength: newData.length,
//       oldDataLength: optionChainData.length,
//     })

//     let alertsTriggered = 0

//     newData.forEach((newItem, index) => {
//       const oldItem = optionChainData[index]
//       if (!oldItem || oldItem.STRIKE_PRICE !== newItem.STRIKE_PRICE) return

//       // Check PE alerts
//       if (oldItem.PE_LTP > 0 && newItem.PE_LTP > 0) {
//         const peChangePercent = Math.abs(((newItem.PE_LTP - oldItem.PE_LTP) / oldItem.PE_LTP) * 100)
//         if (peChangePercent >= alertSettings.threshold) {
//           const alert: PriceAlert = {
//             id: `pe-alert-${Date.now()}-${Math.random()}`,
//             symbol: `${selectedCommodity} PE`,
//             strike: newItem.STRIKE_PRICE,
//             oldPrice: oldItem.PE_LTP,
//             newPrice: newItem.PE_LTP,
//             changePercent: peChangePercent,
//             timestamp: new Date(),
//           }
//           setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//           showAlert(alert)
//           alertsTriggered++
//           console.log("🚨 PE Alert triggered:", alert)
//         }
//       }

//       // Check CE alerts
//       if (oldItem.CE_LTP > 0 && newItem.CE_LTP > 0) {
//         const ceChangePercent = Math.abs(((newItem.CE_LTP - oldItem.CE_LTP) / oldItem.CE_LTP) * 100)
//         if (ceChangePercent >= alertSettings.threshold) {
//           const alert: PriceAlert = {
//             id: `ce-alert-${Date.now()}-${Math.random()}`,
//             symbol: `${selectedCommodity} CE`,
//             strike: newItem.STRIKE_PRICE,
//             oldPrice: oldItem.CE_LTP,
//             newPrice: newItem.CE_LTP,
//             changePercent: ceChangePercent,
//             timestamp: new Date(),
//           }
//           setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//           showAlert(alert)
//           alertsTriggered++
//           console.log("🚨 CE Alert triggered:", alert)
//         }
//       }
//     })

//     console.log(`✅ Alert check complete. ${alertsTriggered} alerts triggered.`)
//   }

//   // Show alert notification
//   const showAlert = (alert: PriceAlert) => {
//     if (!isClient || !alertSettings.enabled) {
//       console.log("🔕 Alert blocked - disabled or not client")
//       return
//     }

//     console.log("🔔 Showing alert:", alert)

//     if (alertSettings.soundEnabled) {
//       const audio = new Audio(
//         "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
//       )
//       audio.play().catch(() => {})
//     }

//     toast({
//       title: "🚨 Option Price Alert!",
//       description: `${alert.symbol} ${alert.strike}: ₹${alert.oldPrice.toFixed(2)} → ₹${alert.newPrice.toFixed(2)} (${alert.changePercent.toFixed(2)}%)`,
//       variant: "destructive",
//       duration: 5000,
//     })

//     if (alert.changePercent > 10) {
//       setShowAlertModal(true)
//     }
//   }

//   // Auto refresh function
//   const performAutoRefresh = async () => {
//     if (!isClient) return

//     await fetchOptionChainData()
//     setLastRefreshTime(new Date())
//     setNextRefreshIn(300)

//     toast({
//       title: "🔄 Auto Refresh Complete",
//       description: "Option chain data has been refreshed.",
//       duration: 3000,
//     })
//   }

//   // Toggle auto refresh
//   const toggleAutoRefresh = () => {
//     if (!isClient) return

//     if (autoRefresh) {
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//       setAutoRefresh(false)
//     } else {
//       setAutoRefresh(true)
//       setNextRefreshIn(300)

//       autoRefreshIntervalRef.current = setInterval(performAutoRefresh, 300000)
//       countdownIntervalRef.current = setInterval(() => {
//         setNextRefreshIn((prev) => {
//           if (prev <= 1) {
//             return 300
//           }
//           return prev - 1
//         })
//       }, 1000)
//     }
//   }

//   const formatCountdown = (seconds: number): string => {
//     const minutes = Math.floor(seconds / 60)
//     const remainingSeconds = seconds % 60
//     return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
//   }

//   const toggleLiveUpdates = () => {
//     if (!isClient) return

//     if (isLive) {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       setIsLive(false)
//     } else {
//       intervalRef.current = setInterval(fetchOptionChainData, 10000) // Update every 10 seconds
//       setIsLive(true)
//     }
//   }

//   // Download CSV function
//   const downloadCSV = () => {
//     if (!isClient) return

//     const headers = [
//       "Strike Price",
//       "PE LTP",
//       "PE Change",
//       "PE Change %",
//       "PE Volume",
//       "PE OI",
//       "PE OI Change",
//       "PE Bid",
//       "PE Ask",
//       "PE Turnover",
//       "CE LTP",
//       "CE Change",
//       "CE Change %",
//       "CE Volume",
//       "CE OI",
//       "CE OI Change",
//       "CE Bid",
//       "CE Ask",
//       "CE Turnover",
//       "Timestamp",
//     ]

//     const csvContent = [
//       headers.join(","),
//       ...historicalData
//         .slice(0, 1000)
//         .map((row) =>
//           [
//             row.STRIKE_PRICE,
//             row.PE_LTP?.toFixed(2) || 0,
//             row.PE_ABS_CHNG?.toFixed(2) || 0,
//             row.PE_PER_CHNG?.toFixed(2) || 0,
//             row.PE_VOLUME || 0,
//             row.PE_OI || 0,
//             row.PE_OI_CHNG || 0,
//             row.PE_BID?.toFixed(2) || 0,
//             row.PE_ASK?.toFixed(2) || 0,
//             row.PE_TURNOVER?.toFixed(2) || 0,
//             row.CE_LTP?.toFixed(2) || 0,
//             row.CE_ABS_CHNG?.toFixed(2) || 0,
//             row.CE_PER_CHNG?.toFixed(2) || 0,
//             row.CE_VOLUME || 0,
//             row.CE_OI || 0,
//             row.CE_OI_CHNG || 0,
//             row.CE_BID?.toFixed(2) || 0,
//             row.CE_ASK?.toFixed(2) || 0,
//             row.CE_TURNOVER?.toFixed(2) || 0,
//             new Date().toLocaleString(),
//           ].join(","),
//         ),
//     ].join("\n")

//     const blob = new Blob([csvContent], { type: "text/csv" })
//     const url = window.URL.createObjectURL(blob)
//     const a = document.createElement("a")
//     a.href = url
//     a.download = `mcx-option-chain-${selectedCommodity}-${new Date().toISOString().split("T")[0]}.csv`
//     document.body.appendChild(a)
//     a.click()
//     document.body.removeChild(a)
//     window.URL.revokeObjectURL(url)

//     toast({
//       title: "Download Complete",
//       description: "Option chain data exported to CSV.",
//     })
//   }

//   // Market Analytics Panel
//   const AnalyticsPanel = () => {
//     if (!analytics || !isClient) return null

//     return (
//       <Card className="mb-4">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <BarChart3 className="w-5 h-5" />
//             Market Analytics - {selectedCommodity}
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Underlying Price</p>
//               <p className="text-3xl font-bold text-blue-600">
//                 ₹{analytics.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//               </p>
//               <Badge variant="outline" className="mt-1">
//                 {selectedCommodity}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Put Call Ratio</p>
//               <p className="text-2xl font-bold">{analytics.putCallRatio.toFixed(2)}</p>
//               <Badge variant={analytics.marketSentiment === "Bullish" ? "default" : "destructive"}>
//                 {analytics.marketSentiment}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max PE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxPEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxPEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max CE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxCEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxCEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Total Volume</p>
//               <p className="text-lg font-bold">
//                 {(analytics.totalPEVolume + analytics.totalCEVolume).toLocaleString()}
//               </p>
//               <p className="text-sm text-gray-600">PE: {analytics.totalPEVolume.toLocaleString()}</p>
//               <p className="text-sm text-gray-600">CE: {analytics.totalCEVolume.toLocaleString()}</p>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     )
//   }

//   // Control Panel
//   const ControlPanel = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Activity className="w-5 h-5" />
//           MCX Option Chain Controls
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="flex flex-wrap gap-4 items-center">
//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Commodity:</label>
//             <select
//               value={selectedCommodity}
//               onChange={(e) => setSelectedCommodity(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {commodities.map((commodity) => (
//                 <option key={commodity} value={commodity}>
//                   {commodity}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Expiry:</label>
//             <select
//               value={selectedExpiry}
//               onChange={(e) => setSelectedExpiry(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {expiries.map((expiry) => (
//                 <option key={expiry} value={expiry}>
//                   {expiry}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <Button onClick={fetchOptionChainData} variant="outline">
//             Fetch Data
//           </Button>

//           <Button
//             onClick={toggleLiveUpdates}
//             variant={isLive ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {isLive ? "Stop Live Updates" : "Start Live Updates (10s)"}
//             {isLive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
//           </Button>

//           <Button
//             onClick={toggleAutoRefresh}
//             variant={autoRefresh ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {autoRefresh ? "Stop Auto Refresh" : "Start Auto Refresh (5min)"}
//           </Button>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="alertEnabled"
//               checked={alertSettings.enabled}
//               onChange={(e) => {
//                 const enabled = e.target.checked
//                 setAlertSettings((prev) => ({ ...prev, enabled }))
//                 console.log("🔔 Alerts", enabled ? "ENABLED" : "DISABLED")
//                 toast({
//                   title: enabled ? "🔔 Alerts Enabled" : "🔕 Alerts Disabled",
//                   description: enabled
//                     ? `Price alerts will trigger at ${alertSettings.threshold}% change`
//                     : "No price alerts will be shown",
//                   duration: 3000,
//                 })
//               }}
//               className="rounded"
//             />
//             <label htmlFor="alertEnabled" className="text-sm font-medium">
//               Enable Alerts
//             </label>
//             {alertSettings.enabled && (
//               <Badge variant="default" className="ml-2">
//                 Active
//               </Badge>
//             )}
//             {!alertSettings.enabled && (
//               <Badge variant="secondary" className="ml-2">
//                 Disabled
//               </Badge>
//             )}
//           </div>

//           <div className="flex items-center space-x-2">
//             <label htmlFor="threshold" className="text-sm font-medium">
//               Alert Threshold:
//             </label>
//             <input
//               type="number"
//               id="threshold"
//               min="1"
//               max="50"
//               step="1"
//               value={alertSettings.threshold}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold: Number.parseInt(e.target.value) }))}
//               className="w-20 px-2 py-1 border rounded text-sm"
//             />
//             <span className="text-sm text-gray-500">%</span>
//           </div>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="soundEnabled"
//               checked={alertSettings.soundEnabled}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
//               disabled={!alertSettings.enabled}
//               className="rounded"
//             />
//             <label htmlFor="soundEnabled" className="text-sm font-medium">
//               Sound Alerts
//             </label>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Market Status Card
//   const MarketStatusCard = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <Activity className="w-5 h-5 text-green-500" />
//             Market Status - {selectedCommodity}
//           </div>
//           <Badge variant={isLive ? "default" : "secondary"}>{isLive ? "LIVE" : "STATIC"}</Badge>
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Current Price</p>
//             <p className="text-4xl font-bold text-blue-600">
//               ₹{analytics?.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//             </p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Last Updated</p>
//             {isClient && lastRefreshTime ? (
//               <>
//                 <p className="text-lg font-semibold">{lastRefreshTime.toLocaleTimeString()}</p>
//                 <p className="text-sm text-gray-500">{lastRefreshTime.toLocaleDateString()}</p>
//               </>
//             ) : (
//               <p className="text-lg font-semibold">Loading...</p>
//             )}
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Total Records</p>
//             <p className="text-2xl font-bold">{optionChainData.length}</p>
//             <p className="text-sm text-gray-500">Option Strikes</p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Data Source</p>
//             <p className="text-lg font-semibold text-green-600">MCX Live</p>
//             <p className="text-sm text-gray-500">Real-time</p>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Critical Alert Modal
//   const CriticalAlertModal = () => {
//     if (!showAlertModal || !isClient || !alertSettings.enabled) return null

//     const latestAlert = alerts[0]
//     if (!latestAlert) return null

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
//           <div className="text-center">
//             <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
//             <h2 className="text-2xl font-bold text-red-600 mb-2">CRITICAL OPTION ALERT!</h2>
//             <div className="space-y-2 mb-6">
//               <p className="text-lg font-semibold">{latestAlert.symbol}</p>
//               <p className="text-gray-600">Strike: {latestAlert.strike}</p>
//               <p className="text-gray-600">
//                 Price: ₹{latestAlert.oldPrice.toFixed(2)} → ₹{latestAlert.newPrice.toFixed(2)}
//               </p>
//               <p className={`text-lg font-bold ${latestAlert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
//                 {latestAlert.changePercent.toFixed(2)}% Change
//               </p>
//               <p className="text-sm text-gray-500">{latestAlert.timestamp.toLocaleString()}</p>
//             </div>
//             <div className="flex gap-2">
//               <Button onClick={() => setShowAlertModal(false)} className="flex-1">
//                 Acknowledge
//               </Button>
//               <Button
//                 variant="outline"
//                 onClick={() => {
//                   setAlertSettings((prev) => ({ ...prev, enabled: false }))
//                   setShowAlertModal(false)
//                   toast({
//                     title: "🔕 Alerts Disabled",
//                     description: "All price alerts have been disabled",
//                     duration: 3000,
//                   })
//                 }}
//                 className="flex-1"
//               >
//                 Disable Alerts
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   // Show loading state during hydration
//   if (!isClient) {
//     return (
//       <div className="min-h-screen bg-gray-50 p-4">
//         <div className="max-w-full mx-auto space-y-6">
//           <div className="flex justify-between items-center">
//             <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           </div>
//           <Card>
//             <CardContent className="flex items-center justify-center py-12">
//               <div className="text-center">
//                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//                 <p className="text-lg font-semibold">Loading MCX Data...</p>
//                 <p className="text-sm text-gray-500">Initializing trading dashboard</p>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 p-4">
//       <div className="max-w-full mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex justify-between items-center">
//           <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           <div className="flex gap-4">
//             <Button onClick={downloadCSV} className="flex items-center gap-2">
//               <Download className="w-4 h-4" />
//               Download CSV
//             </Button>
//           </div>
//         </div>

//         {/* Control Panel */}
//         <ControlPanel />

//         {/* Market Status Card */}
//         <MarketStatusCard />

//         {/* Analytics Panel */}
//         <AnalyticsPanel />

//         {/* Critical Alert Modal */}
//         <CriticalAlertModal />

//         {/* Alerts Section */}
//         {alerts.length > 0 && (
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <AlertTriangle className="w-5 h-5 text-red-500" />
//                   Recent Option Alerts ({alerts.length})
//                 </div>
//                 <Button variant="outline" size="sm" onClick={() => setAlerts([])}>
//                   Clear All
//                 </Button>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-2 max-h-60 overflow-y-auto">
//                 {alerts.slice(0, 10).map((alert) => (
//                   <Alert
//                     key={alert.id}
//                     className={`border-red-200 ${Math.abs(alert.changePercent) > 10 ? "bg-red-50" : ""}`}
//                   >
//                     <AlertDescription>
//                       <div className="flex justify-between items-center">
//                         <div>
//                           <strong>{alert.symbol}</strong> Strike {alert.strike}: ₹{alert.oldPrice.toFixed(2)} → ₹
//                           {alert.newPrice.toFixed(2)}
//                           <span
//                             className={`ml-2 font-semibold ${alert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
//                           >
//                             ({alert.changePercent.toFixed(2)}%)
//                           </span>
//                         </div>
//                         <div className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</div>
//                       </div>
//                     </AlertDescription>
//                   </Alert>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         )}

//         {/* Option Chain Table */}
//         <Card>
//           <CardHeader>
//             <CardTitle>
//               MCX Option Chain - {selectedCommodity} ({selectedExpiry})
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead className="text-center" colSpan={5}>
//                       PUT OPTIONS
//                     </TableHead>
//                     <TableHead className="text-center font-bold">STRIKE</TableHead>
//                     <TableHead className="text-center" colSpan={5}>
//                       CALL OPTIONS
//                     </TableHead>
//                   </TableRow>
//                   <TableRow>
//                     <TableHead>OI</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead className="text-center font-bold">PRICE</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>OI</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {optionChainData.map((item) => (
//                     <TableRow key={item.STRIKE_PRICE}>
//                       {/* PUT OPTIONS */}
//                       <TableCell className="text-blue-600">{item.PE_OI?.toLocaleString() || 0}</TableCell>
//                       <TableCell>{item.PE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="font-bold">₹{item.PE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell className={item.PE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.PE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.PE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.PE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.PE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="text-xs">
//                         {item.PE_BID?.toFixed(2) || 0} / {item.PE_ASK?.toFixed(2) || 0}
//                       </TableCell>

//                       {/* STRIKE PRICE - Highlight ATM strikes */}
//                       <TableCell
//                         className={`text-center font-bold text-lg ${
//                           Math.abs(
//                             item.STRIKE_PRICE -
//                               (analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()),
//                           ) <= 100
//                             ? "bg-yellow-100 text-yellow-800"
//                             : "bg-gray-100"
//                         }`}
//                       >
//                         {item.STRIKE_PRICE}
//                       </TableCell>

//                       {/* CALL OPTIONS */}
//                       <TableCell className="text-xs">
//                         {item.CE_BID?.toFixed(2) || 0} / {item.CE_ASK?.toFixed(2) || 0}
//                       </TableCell>
//                       <TableCell className={item.CE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.CE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.CE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.CE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.CE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="font-bold">₹{item.CE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell>{item.CE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="text-red-600">{item.CE_OI?.toLocaleString() || 0}</TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Historical Data Summary */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Historical Data Summary ({historicalData.length} records)</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-sm text-gray-600">
//               Historical option chain data is being collected. Use the Download CSV button to export all historical
//               records.
//             </p>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }



// "use client"

// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { useToast } from "@/hooks/use-toast"
// import { Activity, AlertTriangle, BarChart3, Download } from "lucide-react"
// import { useEffect, useRef, useState } from "react"
// import { MCXApiService, type AnalyticsData, type OptionChainData } from "../services/mcx-api"

// interface PriceAlert {
//   id: string
//   symbol: string
//   strike: number
//   oldPrice: number
//   newPrice: number
//   changePercent: number
//   timestamp: Date
// }

// interface AlertSettings {
//   enabled: boolean
//   threshold: number
//   soundEnabled: boolean
// }

// export default function MCXTradingApp() {
//   const [optionChainData, setOptionChainData] = useState<OptionChainData[]>([])
//   const [historicalData, setHistoricalData] = useState<OptionChainData[]>([])
//   const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
//   const [alerts, setAlerts] = useState<PriceAlert[]>([])
//   const [isLive, setIsLive] = useState<boolean>(false)
//   const [selectedCommodity, setSelectedCommodity] = useState<string>("CRUDEOIL")
//   const [selectedExpiry, setSelectedExpiry] = useState<string>("17JUL2025")
//   const [showAlertModal, setShowAlertModal] = useState<boolean>(false)
//   const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
//   const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
//   const [nextRefreshIn, setNextRefreshIn] = useState<number>(300)
//   const [isClient, setIsClient] = useState<boolean>(false)

//   const [alertSettings, setAlertSettings] = useState<AlertSettings>({
//     enabled: true,
//     threshold: 5,
//     soundEnabled: true,
//   })
//   const intervalRef = useRef<NodeJS.Timeout | null>(null)
//   const { toast } = useToast()

//   const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

//   const mcxApiService = useRef<MCXApiService>(new MCXApiService())

//   // Available commodities and expiries
//   const commodities = ["CRUDEOIL", "GOLD", "SILVER", "COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"]
//   const expiries = ["17JUL2025", "19AUG2025", "19SEP2025", "21OCT2025", "19NOV2025", "19DEC2025"]

//   // Initialize client-side rendering
//   useEffect(() => {
//     setIsClient(true)
//     setLastRefreshTime(new Date())
//     fetchOptionChainData()

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//     }
//   }, [])

//   // Fetch data when commodity or expiry changes
//   useEffect(() => {
//     if (isClient) {
//       fetchOptionChainData()
//     }
//   }, [selectedCommodity, selectedExpiry, isClient])

//   // Fetch option chain data
//   const fetchOptionChainData = async () => {
//     if (!isClient) return

//     try {
//       const data = await mcxApiService.current.fetchOptionChain(selectedCommodity, selectedExpiry)
//       setOptionChainData(data)

//       // Calculate analytics
//       const analyticsData = mcxApiService.current.calculateAnalytics(data)
//       setAnalytics(analyticsData)

//       // Add to historical data
//       setHistoricalData((prev) => [...data, ...prev.slice(0, 500)]) // Keep last 500 records

//       // Check for alerts
//       checkForAlerts(data)
//     } catch (error) {
//       console.error("Error fetching option chain:", error)
//       if (isClient) {
//         toast({
//           title: "Error",
//           description: "Failed to fetch option chain data. Using mock data.",
//           variant: "destructive",
//         })
//       }
//     }
//   }

//   // Check for price alerts
//   const checkForAlerts = (newData: OptionChainData[]) => {
//     if (!alertSettings.enabled || optionChainData.length === 0 || !isClient) return

//     newData.forEach((newItem, index) => {
//       const oldItem = optionChainData[index]
//       if (!oldItem) return

//       // Check PE alerts
//       const peChangePercent = Math.abs(((newItem.PE_LTP - oldItem.PE_LTP) / oldItem.PE_LTP) * 100)
//       if (peChangePercent > alertSettings.threshold) {
//         const alert: PriceAlert = {
//           id: `pe-alert-${Date.now()}-${Math.random()}`,
//           symbol: `${selectedCommodity} PE`,
//           strike: newItem.STRIKE_PRICE,
//           oldPrice: oldItem.PE_LTP,
//           newPrice: newItem.PE_LTP,
//           changePercent: peChangePercent,
//           timestamp: new Date(),
//         }
//         setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//         showAlert(alert)
//       }

//       // Check CE alerts
//       const ceChangePercent = Math.abs(((newItem.CE_LTP - oldItem.CE_LTP) / oldItem.CE_LTP) * 100)
//       if (ceChangePercent > alertSettings.threshold) {
//         const alert: PriceAlert = {
//           id: `ce-alert-${Date.now()}-${Math.random()}`,
//           symbol: `${selectedCommodity} CE`,
//           strike: newItem.STRIKE_PRICE,
//           oldPrice: oldItem.CE_LTP,
//           newPrice: newItem.CE_LTP,
//           changePercent: ceChangePercent,
//           timestamp: new Date(),
//         }
//         setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//         showAlert(alert)
//       }
//     })
//   }

//   // Show alert notification
//   const showAlert = (alert: PriceAlert) => {
//     if (!isClient) return

//     if (alertSettings.soundEnabled) {
//       const audio = new Audio(
//         "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
//       )
//       audio.play().catch(() => {})
//     }

//     toast({
//       title: "🚨 Option Price Alert!",
//       description: `${alert.symbol} ${alert.strike}: ₹${alert.oldPrice.toFixed(2)} → ₹${alert.newPrice.toFixed(2)} (${alert.changePercent.toFixed(2)}%)`,
//       variant: "destructive",
//       duration: 5000,
//     })

//     if (alert.changePercent > 10) {
//       setShowAlertModal(true)
//     }
//   }

//   // Auto refresh function
//   const performAutoRefresh = async () => {
//     if (!isClient) return

//     await fetchOptionChainData()
//     setLastRefreshTime(new Date())
//     setNextRefreshIn(300)

//     toast({
//       title: "🔄 Auto Refresh Complete",
//       description: "Option chain data has been refreshed.",
//       duration: 3000,
//     })
//   }

//   // Toggle auto refresh
//   const toggleAutoRefresh = () => {
//     if (!isClient) return

//     if (autoRefresh) {
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//         autoRefreshIntervalRef.current = null
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//         countdownIntervalRef.current = null
//       }
//       setAutoRefresh(false)
//     } else {
//       setAutoRefresh(true)
//       setNextRefreshIn(300)

//       autoRefreshIntervalRef.current = setInterval(performAutoRefresh, 300000)
//       countdownIntervalRef.current = setInterval(() => {
//         setNextRefreshIn((prev) => {
//           if (prev <= 1) {
//             return 300
//           }
//           return prev - 1
//         })
//       }, 1000)
//     }
//   }

//   const formatCountdown = (seconds: number): string => {
//     const minutes = Math.floor(seconds / 60)
//     const remainingSeconds = seconds % 60
//     return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
//   }

//   const toggleLiveUpdates = () => {
//     if (!isClient) return

//     if (isLive) {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//         intervalRef.current = null
//       }
//       setIsLive(false)
//     } else {
//       intervalRef.current = setInterval(fetchOptionChainData, 10000) // Update every 10 seconds
//       setIsLive(true)
//     }
//   }

//   // Download CSV function
//   const downloadCSV = () => {
//     if (!isClient) return

//     const headers = [
//       "Strike Price",
//       "PE LTP",
//       "PE Change",
//       "PE Change %",
//       "PE Volume",
//       "PE OI",
//       "PE OI Change",
//       "PE Bid",
//       "PE Ask",
//       "PE Turnover",
//       "CE LTP",
//       "CE Change",
//       "CE Change %",
//       "CE Volume",
//       "CE OI",
//       "CE OI Change",
//       "CE Bid",
//       "CE Ask",
//       "CE Turnover",
//       "Timestamp",
//     ]

//     const csvContent = [
//       headers.join(","),
//       ...historicalData
//         .slice(0, 1000)
//         .map((row) =>
//           [
//             row.STRIKE_PRICE,
//             row.PE_LTP?.toFixed(2) || 0,
//             row.PE_ABS_CHNG?.toFixed(2) || 0,
//             row.PE_PER_CHNG?.toFixed(2) || 0,
//             row.PE_VOLUME || 0,
//             row.PE_OI || 0,
//             row.PE_OI_CHNG || 0,
//             row.PE_BID?.toFixed(2) || 0,
//             row.PE_ASK?.toFixed(2) || 0,
//             row.PE_TURNOVER?.toFixed(2) || 0,
//             row.CE_LTP?.toFixed(2) || 0,
//             row.CE_ABS_CHNG?.toFixed(2) || 0,
//             row.CE_PER_CHNG?.toFixed(2) || 0,
//             row.CE_VOLUME || 0,
//             row.CE_OI || 0,
//             row.CE_OI_CHNG || 0,
//             row.CE_BID?.toFixed(2) || 0,
//             row.CE_ASK?.toFixed(2) || 0,
//             row.CE_TURNOVER?.toFixed(2) || 0,
//             new Date().toLocaleString(),
//           ].join(","),
//         ),
//     ].join("\n")

//     const blob = new Blob([csvContent], { type: "text/csv" })
//     const url = window.URL.createObjectURL(blob)
//     const a = document.createElement("a")
//     a.href = url
//     a.download = `mcx-option-chain-${selectedCommodity}-${new Date().toISOString().split("T")[0]}.csv`
//     document.body.appendChild(a)
//     a.click()
//     document.body.removeChild(a)
//     window.URL.revokeObjectURL(url)

//     toast({
//       title: "Download Complete",
//       description: "Option chain data exported to CSV.",
//     })
//   }

//   // Market Analytics Panel
//   const AnalyticsPanel = () => {
//     if (!analytics || !isClient) return null

//     return (
//       <Card className="mb-4">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <BarChart3 className="w-5 h-5" />
//             Market Analytics - {selectedCommodity}
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Underlying Price</p>
//               <p className="text-3xl font-bold text-blue-600">
//                 ₹{analytics.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//               </p>
//               <Badge variant="outline" className="mt-1">
//                 {selectedCommodity}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Put Call Ratio</p>
//               <p className="text-2xl font-bold">{analytics.putCallRatio.toFixed(2)}</p>
//               <Badge variant={analytics.marketSentiment === "Bullish" ? "default" : "destructive"}>
//                 {analytics.marketSentiment}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max PE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxPEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxPEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max CE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxCEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxCEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Total Volume</p>
//               <p className="text-lg font-bold">
//                 {(analytics.totalPEVolume + analytics.totalCEVolume).toLocaleString()}
//               </p>
//               <p className="text-sm text-gray-600">PE: {analytics.totalPEVolume.toLocaleString()}</p>
//               <p className="text-sm text-gray-600">CE: {analytics.totalCEVolume.toLocaleString()}</p>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     )
//   }

//   // Control Panel
//   const ControlPanel = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Activity className="w-5 h-5" />
//           MCX Option Chain Controls
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="flex flex-wrap gap-4 items-center">
//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Commodity:</label>
//             <select
//               value={selectedCommodity}
//               onChange={(e) => setSelectedCommodity(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {commodities.map((commodity) => (
//                 <option key={commodity} value={commodity}>
//                   {commodity}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Expiry:</label>
//             <select
//               value={selectedExpiry}
//               onChange={(e) => setSelectedExpiry(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {expiries.map((expiry) => (
//                 <option key={expiry} value={expiry}>
//                   {expiry}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <Button onClick={fetchOptionChainData} variant="outline">
//             Fetch Data
//           </Button>

//           <Button
//             onClick={toggleLiveUpdates}
//             variant={isLive ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {isLive ? "Stop Live Updates" : "Start Live Updates (10s)"}
//             {isLive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
//           </Button>

//           <Button
//             onClick={toggleAutoRefresh}
//             variant={autoRefresh ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {autoRefresh ? "Stop Auto Refresh" : "Start Auto Refresh (5min)"}
//           </Button>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="alertEnabled"
//               checked={alertSettings.enabled}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
//               className="rounded"
//             />
//             <label htmlFor="alertEnabled" className="text-sm font-medium">
//               Enable Alerts
//             </label>
//           </div>

//           <div className="flex items-center space-x-2">
//             <label htmlFor="threshold" className="text-sm font-medium">
//               Alert Threshold:
//             </label>
//             <input
//               type="number"
//               id="threshold"
//               min="1"
//               max="50"
//               step="1"
//               value={alertSettings.threshold}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold: Number.parseInt(e.target.value) }))}
//               className="w-20 px-2 py-1 border rounded text-sm"
//             />
//             <span className="text-sm text-gray-500">%</span>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Market Status Card
//   const MarketStatusCard = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <Activity className="w-5 h-5 text-green-500" />
//             Market Status - {selectedCommodity}
//           </div>
//           <Badge variant={isLive ? "default" : "secondary"}>{isLive ? "LIVE" : "STATIC"}</Badge>
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Current Price</p>
//             <p className="text-4xl font-bold text-blue-600">
//               ₹{analytics?.underlyingValue?.toFixed(2) || mcxApiService.current.getUnderlyingValue().toFixed(2)}
//             </p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Last Updated</p>
//             {isClient && lastRefreshTime ? (
//               <>
//                 <p className="text-lg font-semibold">{lastRefreshTime.toLocaleTimeString()}</p>
//                 <p className="text-sm text-gray-500">{lastRefreshTime.toLocaleDateString()}</p>
//               </>
//             ) : (
//               <p className="text-lg font-semibold">Loading...</p>
//             )}
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Total Records</p>
//             <p className="text-2xl font-bold">{optionChainData.length}</p>
//             <p className="text-sm text-gray-500">Option Strikes</p>
//           </div>
//           <div className="text-center">
//             <p className="text-sm text-gray-500">Data Source</p>
//             <p className="text-lg font-semibold text-green-600">MCX Live</p>
//             <p className="text-sm text-gray-500">Real-time</p>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Critical Alert Modal
//   const CriticalAlertModal = () => {
//     if (!showAlertModal || !isClient) return null

//     const latestAlert = alerts[0]
//     if (!latestAlert) return null

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
//           <div className="text-center">
//             <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
//             <h2 className="text-2xl font-bold text-red-600 mb-2">CRITICAL OPTION ALERT!</h2>
//             <div className="space-y-2 mb-6">
//               <p className="text-lg font-semibold">{latestAlert.symbol}</p>
//               <p className="text-gray-600">Strike: {latestAlert.strike}</p>
//               <p className="text-gray-600">
//                 Price: ₹{latestAlert.oldPrice.toFixed(2)} → ₹{latestAlert.newPrice.toFixed(2)}
//               </p>
//               <p className={`text-lg font-bold ${latestAlert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
//                 {latestAlert.changePercent.toFixed(2)}% Change
//               </p>
//               <p className="text-sm text-gray-500">{latestAlert.timestamp.toLocaleString()}</p>
//             </div>
//             <Button onClick={() => setShowAlertModal(false)} className="w-full">
//               Acknowledge Alert
//             </Button>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   // Show loading state during hydration
//   if (!isClient) {
//     return (
//       <div className="min-h-screen bg-gray-50 p-4">
//         <div className="max-w-full mx-auto space-y-6">
//           <div className="flex justify-between items-center">
//             <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           </div>
//           <Card>
//             <CardContent className="flex items-center justify-center py-12">
//               <div className="text-center">
//                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//                 <p className="text-lg font-semibold">Loading MCX Data...</p>
//                 <p className="text-sm text-gray-500">Initializing trading dashboard</p>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 p-4">
//       <div className="max-w-full mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex justify-between items-center">
//           <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           <div className="flex gap-4">
//             <Button onClick={downloadCSV} className="flex items-center gap-2">
//               <Download className="w-4 h-4" />
//               Download CSV
//             </Button>
//           </div>
//         </div>

//         {/* Control Panel */}
//         <ControlPanel />

//         {/* Market Status Card */}
//         <MarketStatusCard />

//         {/* Analytics Panel */}
//         <AnalyticsPanel />

//         {/* Critical Alert Modal */}
//         <CriticalAlertModal />

//         {/* Alerts Section */}
//         {alerts.length > 0 && (
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <AlertTriangle className="w-5 h-5 text-red-500" />
//                   Recent Option Alerts ({alerts.length})
//                 </div>
//                 <Button variant="outline" size="sm" onClick={() => setAlerts([])}>
//                   Clear All
//                 </Button>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-2 max-h-60 overflow-y-auto">
//                 {alerts.slice(0, 10).map((alert) => (
//                   <Alert
//                     key={alert.id}
//                     className={`border-red-200 ${Math.abs(alert.changePercent) > 10 ? "bg-red-50" : ""}`}
//                   >
//                     <AlertDescription>
//                       <div className="flex justify-between items-center">
//                         <div>
//                           <strong>{alert.symbol}</strong> Strike {alert.strike}: ₹{alert.oldPrice.toFixed(2)} → ₹
//                           {alert.newPrice.toFixed(2)}
//                           <span
//                             className={`ml-2 font-semibold ${alert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
//                           >
//                             ({alert.changePercent.toFixed(2)}%)
//                           </span>
//                         </div>
//                         <div className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</div>
//                       </div>
//                     </AlertDescription>
//                   </Alert>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         )}

//         {/* Option Chain Table */}
//         <Card>
//           <CardHeader>
//             <CardTitle>
//               MCX Option Chain - {selectedCommodity} ({selectedExpiry})
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead className="text-center" colSpan={5}>
//                       PUT OPTIONS
//                     </TableHead>
//                     <TableHead className="text-center font-bold">STRIKE</TableHead>
//                     <TableHead className="text-center" colSpan={5}>
//                       CALL OPTIONS
//                     </TableHead>
//                   </TableRow>
//                   <TableRow>
//                     <TableHead>OI</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead className="text-center font-bold">PRICE</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>OI</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {optionChainData.map((item) => (
//                     <TableRow key={item.STRIKE_PRICE}>
//                       {/* PUT OPTIONS */}
//                       <TableCell className="text-blue-600">{item.PE_OI?.toLocaleString() || 0}</TableCell>
//                       <TableCell>{item.PE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="font-bold">₹{item.PE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell className={item.PE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.PE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.PE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.PE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.PE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="text-xs">
//                         {item.PE_BID?.toFixed(2) || 0} / {item.PE_ASK?.toFixed(2) || 0}
//                       </TableCell>

//                       {/* STRIKE PRICE - Highlight ATM strikes */}
//                       <TableCell
//                         className={`text-center font-bold text-lg ${
//                           Math.abs(
//                             item.STRIKE_PRICE -
//                               (analytics?.underlyingValue || mcxApiService.current.getUnderlyingValue()),
//                           ) <= 100
//                             ? "bg-yellow-100 text-yellow-800"
//                             : "bg-gray-100"
//                         }`}
//                       >
//                         {item.STRIKE_PRICE}
//                       </TableCell>

//                       {/* CALL OPTIONS */}
//                       <TableCell className="text-xs">
//                         {item.CE_BID?.toFixed(2) || 0} / {item.CE_ASK?.toFixed(2) || 0}
//                       </TableCell>
//                       <TableCell className={item.CE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         <div className="font-semibold">
//                           {item.CE_ABS_CHNG >= 0 ? "+" : ""}
//                           {item.CE_ABS_CHNG?.toFixed(2) || 0}
//                         </div>
//                         <div className="text-xs">
//                           ({item.CE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.CE_PER_CHNG?.toFixed(2) || 0}%)
//                         </div>
//                       </TableCell>
//                       <TableCell className="font-bold">₹{item.CE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell>{item.CE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="text-red-600">{item.CE_OI?.toLocaleString() || 0}</TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Historical Data Summary */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Historical Data Summary ({historicalData.length} records)</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-sm text-gray-600">
//               Historical option chain data is being collected. Use the Download CSV button to export all historical
//               records.
//             </p>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }




// "use client"

// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { useToast } from "@/hooks/use-toast"
// import { Activity, AlertTriangle, BarChart3, Download } from 'lucide-react'
// import { useEffect, useRef, useState } from "react"
// import { MCXApiService, type AnalyticsData, type OptionChainData } from "../services/mcx-api"

// interface PriceAlert {
//   id: string
//   symbol: string
//   strike: number
//   oldPrice: number
//   newPrice: number
//   changePercent: number
//   timestamp: Date
// }

// interface AlertSettings {
//   enabled: boolean
//   threshold: number
//   soundEnabled: boolean
// }

// export default function MCXTradingApp() {
//   const [optionChainData, setOptionChainData] = useState<OptionChainData[]>([])
//   const [historicalData, setHistoricalData] = useState<OptionChainData[]>([])
//   const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
//   const [alerts, setAlerts] = useState<PriceAlert[]>([])
//   const [isLive, setIsLive] = useState(false)
//   const [selectedCommodity, setSelectedCommodity] = useState("CRUDEOIL")
//   const [selectedExpiry, setSelectedExpiry] = useState("17JUL2025")
  
//   // Fixed useRef with proper initial values
//   const intervalRef = useRef<NodeJS.Timeout | null>(null)
//   const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
//   const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
//   const { toast } = useToast()

//   const [alertSettings, setAlertSettings] = useState<AlertSettings>({
//     enabled: true,
//     threshold: 5,
//     soundEnabled: true,
//   })
//   const [showAlertModal, setShowAlertModal] = useState(false)

//   const [autoRefresh, setAutoRefresh] = useState(false)
//   const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date())
//   const [nextRefreshIn, setNextRefreshIn] = useState(300)

//   const mcxApiService = useRef(new MCXApiService())

//   // Available commodities and expiries
//   const commodities = ["CRUDEOIL", "GOLD", "SILVER", "COPPER", "ZINC", "LEAD", "NICKEL", "ALUMINIUM"]
//   const expiries = ["17JUL2025", "19AUG2025", "19SEP2025", "21OCT2025", "19NOV2025", "19DEC2025"]

//   // Fetch option chain data
//   const fetchOptionChainData = async () => {
//     try {
//       const data = await mcxApiService.current.fetchOptionChain(selectedCommodity, selectedExpiry)
//       setOptionChainData(data)

//       // Calculate analytics
//       const analyticsData = mcxApiService.current.calculateAnalytics(data)
//       setAnalytics(analyticsData)

//       // Add to historical data
//       setHistoricalData((prev) => [...data, ...prev.slice(0, 500)]) // Keep last 500 records

//       // Check for alerts
//       checkForAlerts(data)
//     } catch (error) {
//       console.error("Error fetching option chain:", error)
//       toast({
//         title: "Error",
//         description: "Failed to fetch option chain data. Using mock data.",
//         variant: "destructive",
//       })
//     }
//   }

//   // Check for price alerts
//   const checkForAlerts = (newData: OptionChainData[]) => {
//     if (!alertSettings.enabled || optionChainData.length === 0) return

//     newData.forEach((newItem, index) => {
//       const oldItem = optionChainData[index]
//       if (!oldItem) return

//       // Check PE alerts
//       const peChangePercent = Math.abs(((newItem.PE_LTP - oldItem.PE_LTP) / oldItem.PE_LTP) * 100)
//       if (peChangePercent > alertSettings.threshold) {
//         const alert: PriceAlert = {
//           id: `pe-alert-${Date.now()}-${Math.random()}`,
//           symbol: `${selectedCommodity} PE`,
//           strike: newItem.STRIKE_PRICE,
//           oldPrice: oldItem.PE_LTP,
//           newPrice: newItem.PE_LTP,
//           changePercent: peChangePercent,
//           timestamp: new Date(),
//         }
//         setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//         showAlert(alert)
//       }

//       // Check CE alerts
//       const ceChangePercent = Math.abs(((newItem.CE_LTP - oldItem.CE_LTP) / oldItem.CE_LTP) * 100)
//       if (ceChangePercent > alertSettings.threshold) {
//         const alert: PriceAlert = {
//           id: `ce-alert-${Date.now()}-${Math.random()}`,
//           symbol: `${selectedCommodity} CE`,
//           strike: newItem.STRIKE_PRICE,
//           oldPrice: oldItem.CE_LTP,
//           newPrice: newItem.CE_LTP,
//           changePercent: ceChangePercent,
//           timestamp: new Date(),
//         }
//         setAlerts((prev) => [alert, ...prev.slice(0, 19)])
//         showAlert(alert)
//       }
//     })
//   }

//   // Show alert notification
//   const showAlert = (alert: PriceAlert) => {
//     if (alertSettings.soundEnabled) {
//       const audio = new Audio(
//         "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
//       )
//       audio.play().catch(() => {})
//     }

//     toast({
//       title: "🚨 Option Price Alert!",
//       description: `${alert.symbol} ${alert.strike}: ₹${alert.oldPrice.toFixed(2)} → ₹${alert.newPrice.toFixed(2)} (${alert.changePercent.toFixed(2)}%)`,
//       variant: "destructive",
//       duration: 5000,
//     })

//     if (alert.changePercent > 10) {
//       setShowAlertModal(true)
//     }
//   }

//   // Auto refresh function
//   const performAutoRefresh = async () => {
//     await fetchOptionChainData()
//     setLastRefreshTime(new Date())
//     setNextRefreshIn(300)

//     toast({
//       title: "🔄 Auto Refresh Complete",
//       description: "Option chain data has been refreshed.",
//       duration: 3000,
//     })
//   }

//   // Toggle auto refresh
//   const toggleAutoRefresh = () => {
//     if (autoRefresh) {
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//       }
//       setAutoRefresh(false)
//     } else {
//       setAutoRefresh(true)
//       setNextRefreshIn(300)

//       autoRefreshIntervalRef.current = setInterval(performAutoRefresh, 300000)
//       countdownIntervalRef.current = setInterval(() => {
//         setNextRefreshIn((prev) => {
//           if (prev <= 1) {
//             return 300
//           }
//           return prev - 1
//         })
//       }, 1000)
//     }
//   }

//   const formatCountdown = (seconds: number): string => {
//     const minutes = Math.floor(seconds / 60)
//     const remainingSeconds = seconds % 60
//     return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
//   }

//   const toggleLiveUpdates = () => {
//     if (isLive) {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//       }
//       setIsLive(false)
//     } else {
//       intervalRef.current = setInterval(fetchOptionChainData, 10000) // Update every 10 seconds
//       setIsLive(true)
//     }
//   }

//   // Download CSV function
//   const downloadCSV = () => {
//     const headers = [
//       "Strike Price",
//       "PE LTP",
//       "PE Change",
//       "PE Change %",
//       "PE Volume",
//       "PE OI",
//       "PE OI Change",
//       "PE Bid",
//       "PE Ask",
//       "PE Turnover",
//       "CE LTP",
//       "CE Change",
//       "CE Change %",
//       "CE Volume",
//       "CE OI",
//       "CE OI Change",
//       "CE Bid",
//       "CE Ask",
//       "CE Turnover",
//       "Timestamp",
//     ]

//     const csvContent = [
//       headers.join(","),
//       ...historicalData
//         .slice(0, 1000)
//         .map((row) =>
//           [
//             row.STRIKE_PRICE,
//             row.PE_LTP?.toFixed(2) || 0,
//             row.PE_ABS_CHNG?.toFixed(2) || 0,
//             row.PE_PER_CHNG?.toFixed(2) || 0,
//             row.PE_VOLUME || 0,
//             row.PE_OI || 0,
//             row.PE_OI_CHNG || 0,
//             row.PE_BID?.toFixed(2) || 0,
//             row.PE_ASK?.toFixed(2) || 0,
//             row.PE_TURNOVER?.toFixed(2) || 0,
//             row.CE_LTP?.toFixed(2) || 0,
//             row.CE_ABS_CHNG?.toFixed(2) || 0,
//             row.CE_PER_CHNG?.toFixed(2) || 0,
//             row.CE_VOLUME || 0,
//             row.CE_OI || 0,
//             row.CE_OI_CHNG || 0,
//             row.CE_BID?.toFixed(2) || 0,
//             row.CE_ASK?.toFixed(2) || 0,
//             row.CE_TURNOVER?.toFixed(2) || 0,
//             new Date().toLocaleString(),
//           ].join(","),
//         ),
//     ].join("\n")

//     const blob = new Blob([csvContent], { type: "text/csv" })
//     const url = window.URL.createObjectURL(blob)
//     const a = document.createElement("a")
//     a.href = url
//     a.download = `mcx-option-chain-${selectedCommodity}-${new Date().toISOString().split("T")[0]}.csv`
//     document.body.appendChild(a)
//     a.click()
//     document.body.removeChild(a)
//     window.URL.revokeObjectURL(url)

//     toast({
//       title: "Download Complete",
//       description: "Option chain data exported to CSV.",
//     })
//   }

//   // Market Analytics Panel
//   const AnalyticsPanel = () => {
//     if (!analytics) return null

//     return (
//       <Card className="mb-4">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <BarChart3 className="w-5 h-5" />
//             Market Analytics - {selectedCommodity}
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Put Call Ratio</p>
//               <p className="text-2xl font-bold">{analytics.putCallRatio.toFixed(2)}</p>
//               <Badge variant={analytics.marketSentiment === "Bullish" ? "default" : "destructive"}>
//                 {analytics.marketSentiment}
//               </Badge>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max PE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxPEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxPEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Max CE OI</p>
//               <p className="text-2xl font-bold">{analytics.maxCEOIStrike}</p>
//               <p className="text-sm text-gray-600">{analytics.maxCEOI.toLocaleString()}</p>
//             </div>
//             <div className="text-center">
//               <p className="text-sm text-gray-500">Total Volume</p>
//               <p className="text-lg font-bold">
//                 {(analytics.totalPEVolume + analytics.totalCEVolume).toLocaleString()}
//               </p>
//               <p className="text-sm text-gray-600">PE: {analytics.totalPEVolume.toLocaleString()}</p>
//               <p className="text-sm text-gray-600">CE: {analytics.totalCEVolume.toLocaleString()}</p>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     )
//   }

//   // Control Panel
//   const ControlPanel = () => (
//     <Card className="mb-4">
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Activity className="w-5 h-5" />
//           MCX Option Chain Controls
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="flex flex-wrap gap-4 items-center">
//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Commodity:</label>
//             <select
//               value={selectedCommodity}
//               onChange={(e) => setSelectedCommodity(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {commodities.map((commodity) => (
//                 <option key={commodity} value={commodity}>
//                   {commodity}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="flex items-center gap-2">
//             <label className="text-sm font-medium">Expiry:</label>
//             <select
//               value={selectedExpiry}
//               onChange={(e) => setSelectedExpiry(e.target.value)}
//               className="px-3 py-1 border rounded text-sm"
//             >
//               {expiries.map((expiry) => (
//                 <option key={expiry} value={expiry}>
//                   {expiry}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <Button onClick={fetchOptionChainData} variant="outline">
//             Fetch Data
//           </Button>

//           <Button
//             onClick={toggleLiveUpdates}
//             variant={isLive ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {isLive ? "Stop Live Updates" : "Start Live Updates (10s)"}
//             {isLive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
//           </Button>

//           <Button
//             onClick={toggleAutoRefresh}
//             variant={autoRefresh ? "destructive" : "default"}
//             className="flex items-center gap-2"
//           >
//             {autoRefresh ? "Stop Auto Refresh" : "Start Auto Refresh (5min)"}
//           </Button>

//           <div className="flex items-center space-x-2">
//             <input
//               type="checkbox"
//               id="alertEnabled"
//               checked={alertSettings.enabled}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
//               className="rounded"
//             />
//             <label htmlFor="alertEnabled" className="text-sm font-medium">
//               Enable Alerts
//             </label>
//           </div>

//           <div className="flex items-center space-x-2">
//             <label htmlFor="threshold" className="text-sm font-medium">
//               Alert Threshold:
//             </label>
//             <input
//               type="number"
//               id="threshold"
//               min="1"
//               max="50"
//               step="1"
//               value={alertSettings.threshold}
//               onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold: Number.parseInt(e.target.value) }))}
//               className="w-20 px-2 py-1 border rounded text-sm"
//             />
//             <span className="text-sm text-gray-500">%</span>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )

//   // Critical Alert Modal
//   const CriticalAlertModal = () => {
//     if (!showAlertModal) return null

//     const latestAlert = alerts[0]
//     if (!latestAlert) return null

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
//           <div className="text-center">
//             <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
//             <h2 className="text-2xl font-bold text-red-600 mb-2">CRITICAL OPTION ALERT!</h2>
//             <div className="space-y-2 mb-6">
//               <p className="text-lg font-semibold">{latestAlert.symbol}</p>
//               <p className="text-gray-600">Strike: {latestAlert.strike}</p>
//               <p className="text-gray-600">
//                 Price: ₹{latestAlert.oldPrice.toFixed(2)} → ₹{latestAlert.newPrice.toFixed(2)}
//               </p>
//               <p className={`text-lg font-bold ${latestAlert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
//                 {latestAlert.changePercent.toFixed(2)}% Change
//               </p>
//               <p className="text-sm text-gray-500">{latestAlert.timestamp.toLocaleString()}</p>
//             </div>
//             <Button onClick={() => setShowAlertModal(false)} className="w-full">
//               Acknowledge Alert
//             </Button>
//           </div>
//         </div>
//       </div>
//     )
//   }

//   // Initialize data on component mount
//   useEffect(() => {
//     fetchOptionChainData()

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current)
//       }
//       if (autoRefreshIntervalRef.current) {
//         clearInterval(autoRefreshIntervalRef.current)
//       }
//       if (countdownIntervalRef.current) {
//         clearInterval(countdownIntervalRef.current)
//       }
//     }
//   }, [selectedCommodity, selectedExpiry])

//   return (
//     <div className="min-h-screen bg-gray-50 p-4">
//       <div className="max-w-full mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex justify-between items-center">
//           <h1 className="text-3xl font-bold text-gray-900">MCX Option Chain Dashboard</h1>
//           <div className="flex gap-4">
//             <Button onClick={downloadCSV} className="flex items-center gap-2">
//               <Download className="w-4 h-4" />
//               Download CSV
//             </Button>
//           </div>
//         </div>

//         {/* Control Panel */}
//         <ControlPanel />

//         {/* Analytics Panel */}
//         <AnalyticsPanel />

//         {/* Critical Alert Modal */}
//         <CriticalAlertModal />

//         {/* Alerts Section */}
//         {alerts.length > 0 && (
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <AlertTriangle className="w-5 h-5 text-red-500" />
//                   Recent Option Alerts ({alerts.length})
//                 </div>
//                 <Button variant="outline" size="sm" onClick={() => setAlerts([])}>
//                   Clear All
//                 </Button>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-2 max-h-60 overflow-y-auto">
//                 {alerts.slice(0, 10).map((alert) => (
//                   <Alert
//                     key={alert.id}
//                     className={`border-red-200 ${Math.abs(alert.changePercent) > 10 ? "bg-red-50" : ""}`}
//                   >
//                     <AlertDescription>
//                       <div className="flex justify-between items-center">
//                         <div>
//                           <strong>{alert.symbol}</strong> Strike {alert.strike}: ₹{alert.oldPrice.toFixed(2)} → ₹
//                           {alert.newPrice.toFixed(2)}
//                           <span
//                             className={`ml-2 font-semibold ${alert.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
//                           >
//                             ({alert.changePercent.toFixed(2)}%)
//                           </span>
//                         </div>
//                         <div className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</div>
//                       </div>
//                     </AlertDescription>
//                   </Alert>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         )}

//         {/* Option Chain Table */}
//         <Card>
//           <CardHeader>
//             <CardTitle>
//               MCX Option Chain - {selectedCommodity} ({selectedExpiry})
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead className="text-center" colSpan={5}>
//                       PUT OPTIONS
//                     </TableHead>
//                     <TableHead className="text-center font-bold">STRIKE</TableHead>
//                     <TableHead className="text-center" colSpan={5}>
//                       CALL OPTIONS
//                     </TableHead>
//                   </TableRow>
//                   <TableRow>
//                     <TableHead>OI</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead className="text-center font-bold">PRICE</TableHead>
//                     <TableHead>Bid/Ask</TableHead>
//                     <TableHead>Change</TableHead>
//                     <TableHead>LTP</TableHead>
//                     <TableHead>Volume</TableHead>
//                     <TableHead>OI</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {optionChainData.map((item) => (
//                     <TableRow key={item.STRIKE_PRICE}>
//                       {/* PUT OPTIONS */}
//                       <TableCell className="text-blue-600">{item.PE_OI?.toLocaleString() || 0}</TableCell>
//                       <TableCell>{item.PE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="font-bold">₹{item.PE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell className={item.PE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         {item.PE_ABS_CHNG >= 0 ? "+" : ""}
//                         {item.PE_ABS_CHNG?.toFixed(2) || 0}
//                         <br />
//                         <span className="text-xs">
//                           ({item.PE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.PE_PER_CHNG?.toFixed(2) || 0}%)
//                         </span>
//                       </TableCell>
//                       <TableCell className="text-xs">
//                         {item.PE_BID?.toFixed(2) || 0} / {item.PE_ASK?.toFixed(2) || 0}
//                       </TableCell>

//                       {/* STRIKE PRICE */}
//                       <TableCell className="text-center font-bold text-lg bg-gray-100">{item.STRIKE_PRICE}</TableCell>

//                       {/* CALL OPTIONS */}
//                       <TableCell className="text-xs">
//                         {item.CE_BID?.toFixed(2) || 0} / {item.CE_ASK?.toFixed(2) || 0}
//                       </TableCell>
//                       <TableCell className={item.CE_ABS_CHNG >= 0 ? "text-green-600" : "text-red-600"}>
//                         {item.CE_ABS_CHNG >= 0 ? "+" : ""}
//                         {item.CE_ABS_CHNG?.toFixed(2) || 0}
//                         <br />
//                         <span className="text-xs">
//                           ({item.CE_PER_CHNG >= 0 ? "+" : ""}
//                           {item.CE_PER_CHNG?.toFixed(2) || 0}%)
//                         </span>
//                       </TableCell>
//                       <TableCell className="font-bold">₹{item.CE_LTP?.toFixed(2) || 0}</TableCell>
//                       <TableCell>{item.CE_VOLUME?.toLocaleString() || 0}</TableCell>
//                       <TableCell className="text-red-600">{item.CE_OI?.toLocaleString() || 0}</TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Historical Data Summary */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Historical Data Summary ({historicalData.length} records)</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-sm text-gray-600">
//               Historical option chain data is being collected. Use the Download CSV button to export all historical
//               records.
//             </p>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }