/**
 * Script: Get Opportunity - Dump completo
 * API: GoHighLevel / LeadConnector
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ================= CONFIGURAÇÕES =================
const OPPORTUNITY_ID = "xY8HsWc9Avf68LORsPK5";
const PIT_TOKEN = "pit-f49270d8-e026-450c-a2d2-43d255445317";

const API_URL = `https://services.leadconnectorhq.com/opportunities/${OPPORTUNITY_ID}`;

// Pasta e arquivo de saída
const OUTPUT_DIR = path.join(__dirname, "output");
const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  `opportunity-${OPPORTUNITY_ID}.json`
);

// ================= EXECUÇÃO =================
async function getOpportunity() {
  try {
    const response = await axios.get(API_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${PIT_TOKEN}`,
        Version: "2021-07-28",
      },
    });

    const opportunity = response.data.opportunity;

    // Garante que a pasta exista
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Salva JSON COMPLETO
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(opportunity, null, 2),
      "utf-8"
    );

    // ================= RESUMO RÁPIDO =================
    const resumo = {
      id: opportunity.id,
      name: opportunity.name,
      status: opportunity.status,
      monetaryValue: opportunity.monetaryValue,
      pipelineId: opportunity.pipelineId,
      pipelineStageId: opportunity.pipelineStageId,
      assignedTo: opportunity.assignedTo,
      contactId: opportunity.contactId,
      locationId: opportunity.locationId,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
      lastStageChangeAt: opportunity.lastStageChangeAt,
      lastStatusChangeAt: opportunity.lastStatusChangeAt,
    };

    console.log("✅ Oportunidade encontrada:");
    console.table(resumo);

    console.log("📁 JSON completo salvo em:");
    console.log(OUTPUT_FILE);
  } catch (error) {
    if (error.response) {
      console.error("❌ Erro da API:");
      console.error("Status:", error.response.status);
      console.error("Resposta:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("❌ Erro inesperado:", error.message);
    }
  }
}

// ================= START =================
getOpportunity();
