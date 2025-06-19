import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Métriques personnalisées
const errorRate = new Rate("errors");
const authDuration = new Trend("auth_duration");
const feedbackFetchDuration = new Trend("feedback_fetch_duration");

export const options = {
  stages: [
    { duration: "30s", target: 20 },   // Montée progressive
    { duration: "1m", target: 50 },    // Charge normale
    { duration: "30s", target: 100 },  // Pic de charge
    { duration: "1m", target: 50 },    // Retour à la normale
    { duration: "30s", target: 0 },    // Descente
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],        // 95% des requêtes < 500ms
    http_req_failed: ["rate<0.1"],          // Moins de 10% d'erreurs
    errors: ["rate<0.1"],                   // Moins de 10% d'erreurs custom
    auth_duration: ["p(95)<300"],           // Auth < 300ms
    feedback_fetch_duration: ["p(95)<400"], // Fetch feedbacks < 400ms
  },
};

// Configuration des endpoints
const BASE_URL = "http://localhost:3000";
const ENDPOINTS = {
  LOGIN: `${BASE_URL}/api/auth/login`,
  FEEDBACK: `${BASE_URL}/api/feedback`,
  METRICS: `${BASE_URL}/api/metrics`,
  REGISTER: `${BASE_URL}/api/auth/register`,
};

// Données de test
const TEST_USERS = [
  { email: "test@test.com", password: "testee" },
  { email: "test@test2.com", password: "testee" },
];

export function getAuthToken() {
  const startTime = Date.now();
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  
  const response = http.post(
    ENDPOINTS.LOGIN,
    JSON.stringify(user),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "login" },
    }
  );
  
  const duration = Date.now() - startTime;
  authDuration.add(duration);
  
  console.log(`Login response: ${response.status} (${duration}ms)`);
  
  const success = check(response, {
    "login status is 200": (r) => r.status === 200,
    "login response has token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  if (!success) {
    errorRate.add(1);
    return null;
  }
  
  errorRate.add(0);
  return JSON.parse(response.body).token;
}

export function setup() {
  console.log("🚀 Starting k6 performance tests...");
  
  const token = getAuthToken();
  if (!token) {
    console.error("❌ Failed to get auth token during setup");
    return null;
  }
  
  console.log("✅ Authentication successful");
  return { token };
}

export default function(data) {
  if (!data || !data.token) {
    console.error("❌ No auth token available");
    errorRate.add(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${data.token}`,
    "Content-Type": "application/json",
  };

  // Test 1: Récupération des feedbacks
  testFeedbackFetch(headers);
  
  // Test 2: Ajout d'un feedback (occasionnel)
  if (Math.random() < 0.3) { // 30% de chance
    testFeedbackCreation(headers);
  }
  
  // Test 3: Envoi des métriques (occasionnel)
  if (__VU === 1 && __ITER % 10 === 0) { // Premier VU, toutes les 10 itérations
    sendMetricsToAPI(headers);
  }
  
  sleep(1 + Math.random() * 2); // Sleep variable entre 1-3s
}

function testFeedbackFetch(headers) {
  const startTime = Date.now();
  
  const response = http.get(ENDPOINTS.FEEDBACK, {
    headers,
    tags: { endpoint: "feedback_fetch" },
  });
  
  const duration = Date.now() - startTime;
  feedbackFetchDuration.add(duration);
  
  const success = check(response, {
    "feedback fetch status is 200": (r) => r.status === 200,
    "feedback fetch response time OK": (r) => r.timings.duration < 1000,
    "feedback fetch has valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
  
  if (!success) {
    errorRate.add(1);
    console.error(`❌ Feedback fetch failed: ${response.status}`);
  } else {
    errorRate.add(0);
  }
}

function testFeedbackCreation(headers) {
  const sampleFeedbacks = [
    { channel: "Twitter", text: "Excellent service, très satisfait !" },
    { channel: "Facebook", text: "Application facile à utiliser" },
    { channel: "mail", text: "Problème résolu rapidement, merci" },
    { channel: "Web", text: "Interface moderne et intuitive" },
  ];
  
  const feedback = sampleFeedbacks[Math.floor(Math.random() * sampleFeedbacks.length)];
  
  const response = http.post(
    ENDPOINTS.FEEDBACK,
    JSON.stringify(feedback),
    {
      headers,
      tags: { endpoint: "feedback_creation" },
    }
  );
  
  const success = check(response, {
    "feedback creation status is 201": (r) => r.status === 201,
    "feedback creation response time OK": (r) => r.timings.duration < 800,
  });
  
  if (!success) {
    errorRate.add(1);
    console.error(`❌ Feedback creation failed: ${response.status}`);
  } else {
    errorRate.add(0);
  }
}

function sendMetricsToAPI(headers) {
  const metrics = {
    timestamp: new Date().toISOString(),
    vu_count: __VU,
    iteration: __ITER,
    test_type: "k6_performance_test",
    stage: getCurrentStage(),
  };
  
  const response = http.post(
    ENDPOINTS.METRICS,
    JSON.stringify({ metrics }),
    {
      headers,
      tags: { endpoint: "metrics" },
    }
  );
  
  check(response, {
    "metrics sent successfully": (r) => r.status === 201,
  });
}

function getCurrentStage() {
  const elapsed = Date.now() - __startTime;
  if (elapsed < 30000) return "ramp_up";
  if (elapsed < 90000) return "normal_load";
  if (elapsed < 120000) return "peak_load";
  if (elapsed < 180000) return "normal_load_2";
  return "ramp_down";
}

export function teardown(data) {
  console.log("🏁 k6 tests completed");
  if (data && data.token) {
    console.log("✅ Tests executed with valid authentication");
  }
}