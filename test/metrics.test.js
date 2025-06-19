import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Métriques personnalisées
const errorRate = new Rate("errors");
const authDuration = new Trend("auth_duration");
const feedbackFetchDuration = new Trend("feedback_fetch_duration");

export const options = {
  stages: [
    { duration: "10s", target: 2 },   // Très réduit pour CI
    { duration: "20s", target: 3 },   // Très réduit pour CI
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],  // Très permissif pour CI
    http_req_failed: ["rate<0.3"],     // Très permissif pour CI
    errors: ["rate<0.3"],              // Très permissif pour CI
    auth_duration: ["p(95)<1000"],     // Plus permissif pour CI
    feedback_fetch_duration: ["p(95)<1200"], // Plus permissif pour CI
  },
};

const BASE_URL = "http://localhost:3000";
const ENDPOINTS = {
  HEALTH: `${BASE_URL}/api/auth/health`,
  LOGIN: `${BASE_URL}/api/auth/login`,
  REGISTER: `${BASE_URL}/api/auth/register`,
  FEEDBACK: `${BASE_URL}/api/feedback`,
  METRICS: `${BASE_URL}/api/metrics`,
};

// Données de test
const TEST_USERS = [
  { email: "k6test1@example.com", password: "K6TestPassword123!" },
  { email: "k6test2@example.com", password: "K6TestPassword123!" },
  { email: "k6test3@example.com", password: "K6TestPassword123!" },
];

// Fonction pour vérifier que l'API est accessible
function waitForAPI() {
  console.log("🔍 Checking API availability...");
  
  for (let i = 0; i < 60; i++) { // 60 tentatives = 2 minutes max
    try {
      const response = http.get(ENDPOINTS.HEALTH, {
        timeout: "10s",
      });
      
      if (response.status === 200) {
        console.log(`✅ API is accessible (attempt ${i + 1})`);
        return true;
      }
      
      console.log(`⏳ API not ready yet (attempt ${i + 1}/60), status: ${response.status}`);
    } catch (error) {
      console.log(`⏳ API connection error (attempt ${i + 1}/60): ${error.message || error}`);
    }
    
    sleep(2); // Attendre 2 secondes entre chaque tentative
  }
  
  console.error("❌ API is not accessible after 2 minutes");
  return false;
}

// Fonction pour créer un utilisateur avec retry
function createTestUser(user, maxRetries = 3) {
  console.log(`Creating test user: ${user.email}`);
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const response = http.post(
        ENDPOINTS.REGISTER,
        JSON.stringify(user),
        {
          headers: { "Content-Type": "application/json" },
          tags: { endpoint: "register" },
          timeout: "10s",
        }
      );
      
      if (response.status === 201) {
        console.log(`✅ User created: ${user.email}`);
        return true;
      } else if (response.status === 409) {
        console.log(`ℹ️ User already exists: ${user.email}`);
        return true;
      } else {
        console.log(`⚠️ User creation attempt ${retry + 1} failed: ${response.status} - ${response.body}`);
        if (retry < maxRetries - 1) {
          sleep(2);
        }
      }
    } catch (error) {
      console.log(`⚠️ User creation attempt ${retry + 1} error: ${error}`);
      if (retry < maxRetries - 1) {
        sleep(2);
      }
    }
  }
  
  console.error(`❌ Failed to create user ${user.email} after ${maxRetries} attempts`);
  return false;
}

export function getAuthToken() {
  const startTime = Date.now();
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  
  // Essayer de créer l'utilisateur d'abord
  createTestUser(user);
  sleep(1); // Attendre un peu
  
  const response = http.post(
    ENDPOINTS.LOGIN,
    JSON.stringify(user),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "login" },
      timeout: "10s",
    }
  );
  
  const duration = Date.now() - startTime;
  authDuration.add(duration);
  
  console.log(`Login response for ${user.email}: ${response.status} (${duration}ms)`);
  
  if (response.status !== 200) {
    console.error(`❌ Login failed for ${user.email}: ${response.body}`);
  }
  
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
  
  // Attendre que l'API soit accessible
  if (!waitForAPI()) {
    console.error("❌ API is not accessible, aborting tests");
    return null;
  }
  
  // Créer tous les utilisateurs de test
  console.log("📋 Creating test users...");
  let usersCreated = 0;
  
  TEST_USERS.forEach(user => {
    if (createTestUser(user)) {
      usersCreated++;
    }
    sleep(0.5);
  });
  
  if (usersCreated === 0) {
    console.error("❌ No test users could be created");
    return null;
  }
  
  console.log(`✅ Created ${usersCreated}/${TEST_USERS.length} test users`);
  
  console.log("🔐 Getting authentication token...");
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

  testFeedbackFetch(headers);
  
  if (Math.random() < 0.3) {
    testFeedbackCreation(headers);
  }
  
  if (__VU === 1 && __ITER % 10 === 0) {
    sendMetricsToAPI(headers);
  }
  
  sleep(1 + Math.random() * 2);
}

function testFeedbackFetch(headers) {
  const startTime = Date.now();
  
  const response = http.get(ENDPOINTS.FEEDBACK, {
    headers,
    tags: { endpoint: "feedback_fetch" },
    timeout: "10s",
  });
  
  const duration = Date.now() - startTime;
  feedbackFetchDuration.add(duration);
  
  const success = check(response, {
    "feedback fetch status is 200": (r) => r.status === 200,
    "feedback fetch response time OK": (r) => r.timings.duration < 2000,
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
      timeout: "10s",
    }
  );
  
  const success = check(response, {
    "feedback creation status is 201": (r) => r.status === 201,
    "feedback creation response time OK": (r) => r.timings.duration < 1500,
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
    stage: "ci_test",
  };
  
  const response = http.post(
    ENDPOINTS.METRICS,
    JSON.stringify({ metrics }),
    {
      headers,
      tags: { endpoint: "metrics" },
      timeout: "10s",
    }
  );
  
  check(response, {
    "metrics sent successfully": (r) => r.status === 201,
  });
}

export function teardown(data) {
  console.log("🏁 k6 tests completed");
  if (data && data.token) {
    console.log("✅ Tests executed with valid authentication");
  } else {
    console.log("⚠️ Tests executed without authentication (setup failed)");
  }
}