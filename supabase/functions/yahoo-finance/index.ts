import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight globally for browser invocation
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { ticker } = await req.json()

        if (!ticker) {
            return new Response(JSON.stringify({ error: 'Ticker is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // Pass valid User-Agent to prevent basic 403s block mechanisms
        const yahooHeaders = new Headers();
        yahooHeaders.append("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        const response = await fetch(`https://query2.finance.yahoo.com/v10/finance/quoteModules/v1?symbol=${ticker}&modules=price`, {
            headers: yahooHeaders
        });

        const data = await response.json();

        // Extract real-time underlying price if available
        if (data?.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw) {
            const price = data.quoteSummary.result[0].price.regularMarketPrice.raw;
            return new Response(JSON.stringify({ price }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Clean fallback missing/unmapped tickers
        return new Response(JSON.stringify({ price: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
