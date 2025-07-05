import { NextResponse } from "next/server"

const MCX_URL = "https://www.mcxindia.com/backpage.aspx/GetOptionChain"

// Define the MCX API response types
interface MCXOptionItem {
  CE_AbsoluteChange: number
  CE_AskPrice: number
  CE_AskQty: number
  CE_BidPrice: number
  CE_BidQty: number
  CE_ChangeInOI: number
  CE_LTP: number
  CE_LTT: string
  CE_NetChange: number
  CE_OpenInterest: number
  CE_StrikePrice: number
  CE_Volume: number
  PE_AbsoluteChange: number
  PE_AskPrice: number
  PE_AskQty: number
  PE_BidPrice: number
  PE_BidQty: number
  PE_ChangeInOI: number
  PE_LTP: number
  PE_LTT: string
  PE_NetChange: number
  PE_OpenInterest: number
  PE_Volume: number
  UnderlyingValue: number
  Symbol: string | null
  ExpiryDate: string | null
  LTT: string
  ExtensionData: object
}

interface MCXApiResponse {
  d: {
    __type: string
    ExtensionData: object
    Data: MCXOptionItem[]
    Summary: {
      ExtensionData: object
      AsOn: string
      Count: number
      Status: string | null
    }
  }
}

// Define our transformed option chain data type
interface TransformedOptionData {
  STRIKE_PRICE: number
  PE_LTP: number
  PE_ABS_CHNG: number
  PE_PER_CHNG: number
  PE_VOLUME: number
  PE_OI: number
  PE_OI_CHNG: number
  PE_BID: number
  PE_ASK: number
  PE_TURNOVER: number
  CE_LTP: number
  CE_ABS_CHNG: number
  CE_PER_CHNG: number
  CE_VOLUME: number
  CE_OI: number
  CE_OI_CHNG: number
  CE_BID: number
  CE_ASK: number
  CE_TURNOVER: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const commodity = searchParams.get("commodity") || "CRUDEOIL"
  const expiry = searchParams.get("expiry") || "17JUL2025"

  console.log(`🔍 MCX API Request: ${commodity} - ${expiry}`)
  console.log(`📡 Calling MCX URL: ${MCX_URL}`)

  try {
    const upstream = await fetch(MCX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.mcxindia.com/",
        Origin: "https://www.mcxindia.com",
      },
      body: JSON.stringify({ Commodity: commodity, Expiry: expiry }),
    })

    console.log(`📊 MCX Response Status: ${upstream.status}`)
    console.log(`📊 MCX Response Headers:`, Object.fromEntries(upstream.headers.entries()))

    const text = await upstream.text()
    console.log(`📄 MCX Response Length: ${text.length} characters`)
    console.log(`📄 MCX Response Preview: ${text.substring(0, 200)}...`)

    // Check if response is HTML
    if (text.trim().startsWith("<")) {
      console.log("❌ MCX returned HTML document instead of JSON")
      return NextResponse.json({ error: "MCX returned HTML document" }, { status: 502 })
    }

    // Parse the JSON response
    let json: MCXApiResponse
    try {
      json = JSON.parse(text)
    } catch (parseError) {
      console.log("Failed to parse MCX response as JSON:", parseError)
      return NextResponse.json({ error: "Invalid JSON response from MCX" }, { status: 502 })
    }

    // Handle the real MCX API structure: { "d": { "Data": [...] } }
    let optionChainData: TransformedOptionData[] = []
    let underlyingValue = 0

    if (json && json.d && json.d.Data && Array.isArray(json.d.Data)) {
      const rawData = json.d.Data

      // Get underlying value from first record
      if (rawData.length > 0 && rawData[0].UnderlyingValue) {
        underlyingValue = rawData[0].UnderlyingValue
      }

      // Transform MCX data to our expected format
      optionChainData = rawData.map(
        (item: MCXOptionItem): TransformedOptionData => ({
          STRIKE_PRICE: item.CE_StrikePrice || 0,

          // PUT Options (PE)
          PE_LTP: item.PE_LTP || 0,
          PE_ABS_CHNG: item.PE_AbsoluteChange || 0,
          PE_PER_CHNG: item.PE_NetChange || 0,
          PE_VOLUME: item.PE_Volume || 0,
          PE_OI: item.PE_OpenInterest || 0,
          PE_OI_CHNG: item.PE_ChangeInOI || 0,
          PE_BID: item.PE_BidPrice || 0,
          PE_ASK: item.PE_AskPrice || 0,
          PE_TURNOVER: (item.PE_LTP || 0) * (item.PE_Volume || 0),

          // CALL Options (CE)
          CE_LTP: item.CE_LTP || 0,
          CE_ABS_CHNG: item.CE_AbsoluteChange || 0,
          CE_PER_CHNG: item.CE_NetChange || 0,
          CE_VOLUME: item.CE_Volume || 0,
          CE_OI: item.CE_OpenInterest || 0,
          CE_OI_CHNG: item.CE_ChangeInOI || 0,
          CE_BID: item.CE_BidPrice || 0,
          CE_ASK: item.CE_AskPrice || 0,
          CE_TURNOVER: (item.CE_LTP || 0) * (item.CE_Volume || 0),
        }),
      )

      // Filter out records with no strike price
      optionChainData = optionChainData.filter((item: TransformedOptionData) => item.STRIKE_PRICE > 0)
    }

    console.log(`Successfully parsed MCX data: ${optionChainData.length} records, Underlying: ${underlyingValue}`)

    return NextResponse.json(
      {
        data: optionChainData,
        underlyingValue: underlyingValue,
        timestamp: new Date().toISOString(),
        source: "MCX_LIVE",
      },
      { status: 200 },
    )
  } catch (err) {
    console.error("❌ MCX API Proxy error:", err)
    console.error("❌ Error details:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 })
  }
}
