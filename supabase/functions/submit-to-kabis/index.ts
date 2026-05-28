import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface KabisPayload {
  rentalId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { rentalId }: KabisPayload = await req.json();

    if (!rentalId) {
      return new Response(
        JSON.stringify({ error: "rentalId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select("*, vehicles(plate, brand, model), customers(tc_kimlik_no, first_name, last_name, father_name, birth_place, birth_date, passport_no, nationality, is_foreign, company_title)")
      .eq("id", rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      return new Response(
        JSON.stringify({ error: "Rental not found", details: rentalError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PLACEHOLDER: Future Emniyet KABIS API integration
    // When the official API is available, replace this block with:
    // 1. Format the payload per Emniyet API specs
    // 2. POST to the Emniyet KABIS endpoint
    // 3. Parse the response and update rental status accordingly
    //
    // Expected API contract (hypothetical):
    // POST https://kabis.egm.gov.tr/api/v1/bildirim
    // Headers: { Authorization: Bearer <KABIS_API_KEY> }
    // Body: { tc_kimlik_no, ad, soyad, baba_adi, dogum_yeri, dogum_tarihi, plaka, sozlesme_baslangic, sozlesme_bitis }
    //
    // For now, this function validates the data and marks the rental as reported.

    const customer = rental.customers;
    const isForeign = customer?.is_foreign === true;

    const missingFields: string[] = [];
    if (!isForeign) {
      if (!customer?.tc_kimlik_no) missingFields.push("tc_kimlik_no");
      if (!customer?.first_name) missingFields.push("first_name");
      if (!customer?.last_name) missingFields.push("last_name");
      if (!customer?.father_name) missingFields.push("father_name");
      if (!customer?.birth_place) missingFields.push("birth_place");
      if (!customer?.birth_date) missingFields.push("birth_date");
    } else {
      if (!customer?.passport_no) missingFields.push("passport_no");
      if (!customer?.nationality) missingFields.push("nationality");
    }

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Missing mandatory KABIS fields",
          missingFields,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as reported
    await supabase
      .from("rentals")
      .update({
        kabis_notification_status: true,
        kabis_reported_by: "KABIS_API",
        kabis_reported_at: new Date().toISOString(),
      })
      .eq("id", rentalId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "KABIS bildirimi basariyla tamamlandi (placeholder)",
        rentalId,
        plate: rental.vehicles?.plate,
        customer: customer?.company_title,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
