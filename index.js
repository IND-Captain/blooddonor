const functions = require("firebase-functions");
const admin = require("firebase-admin");
const geolib = require("geolib");

admin.initializeApp();

const db = admin.firestore();

/**
 * Blood compatibility rules.
 * Key: Recipient's blood type.
 * Value: Array of compatible donor blood types.
 */
const bloodCompatibility = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-'],
};

/**
 * AI-driven scoring weights for donor matching.
 * These can be tuned over time based on real-world data.
 */
const scoringWeights = {
    perfectMatch: 50, // High score for a perfect blood type match
    proximity: 30,    // Score based on distance (closer is better)
    recency: 20,      // Score based on how long it's been since the last donation
};

// The maximum distance (in meters) we'll consider for proximity scoring.
const MAX_DISTANCE_FOR_SCORING = 25000; // 25 km

/**
 * Triggered when a new blood request is created.
 * This function finds eligible donors and sends them notifications.
 */
exports.onRequestCreate = functions.firestore
    .document('requests/{requestId}')
    .onCreate(async (snap, context) => {
        const request = snap.data();
        const { bloodType, location, city, isEmergency } = request;

        functions.logger.log(`New request ${context.params.requestId} for blood type ${bloodType} in ${city}.`);

        // 1. Determine compatible donor blood types
        const compatibleDonorTypes = bloodCompatibility[bloodType];
        if (!compatibleDonorTypes || compatibleDonorTypes.length === 0) {
            functions.logger.error(`Invalid blood type in request: ${bloodType}`);
            return null;
        }

        functions.logger.log(`Compatible donor types: ${compatibleDonorTypes.join(", ")}`);

        // 2. Geospatial Query for eligible donors
        try {
            // Use a wider radius for emergencies
            const radiusInM = isEmergency ? 50 * 1000 : 25 * 1000; // 50km for emergency, 25km otherwise

            // Get the bounding box for the query
            const bounds = geolib.getBoundsOfDistance(
                { latitude: location.latitude, longitude: location.longitude },
                radiusInM
            );

            const donorsRef = db.collection('donors');

            // Calculate the date 56 days ago (standard minimum time between donations)
            const minDonationDate = new Date();
            minDonationDate.setDate(minDonationDate.getDate() - 56);

            // Build the broad-phase query using the bounding box
            const query = donorsRef
                .where('bloodType', 'in', compatibleDonorTypes)
                .where('availability', '==', 'available')
                .where('location', '>=', new admin.firestore.GeoPoint(bounds[0].latitude, bounds[0].longitude))
                .where('location', '<=', new admin.firestore.GeoPoint(bounds[1].latitude, bounds[1].longitude));

            const querySnapshot = await query.get();

            if (querySnapshot.empty) {
                functions.logger.log("No donors found in the initial bounding box query.");
                return null;
            }

            // 3. Refine, Score, and Rank Eligible Donors
            const eligibleDonors = [];
            querySnapshot.forEach(doc => {
                const donor = doc.data();
                const distanceInM = geolib.getDistance(
                    { latitude: location.latitude, longitude: location.longitude },
                    { latitude: donor.location.latitude, longitude: donor.location.longitude }
                );
                
                // Filter out donors outside the radius and those who donated recently
                if (distanceInM <= radiusInM && (!donor.lastDonationDate || donor.lastDonationDate.toDate() < minDonationDate)) {
                    const score = calculateScore(donor, request, distanceInM);
                    eligibleDonors.push({ id: doc.id, score, ...donor });
                }
            });

            if (eligibleDonors.length === 0) {
                functions.logger.log("No eligible donors found after filtering.");
                return null;
            }

            // Sort donors by score in descending order
            eligibleDonors.sort((a, b) => b.score - a.score);

            functions.logger.log(`Ranked ${eligibleDonors.length} potential donors.`);

            // 4. Select top N donors for notification
            const topDonors = eligibleDonors.slice(0, 10); // Notify the top 10 best matches

            // Log the top donors and their scores for analytics
            topDonors.forEach(d => {
                functions.logger.log(`  - Donor: ${d.id}, Score: ${d.score.toFixed(2)}`);
            });

            // 5. Get FCM tokens for the top donors
            const fcmTokens = [];
            for (const donor of topDonors) {
                const userSnap = await db.collection('users').doc(donor.id).get();
                if (userSnap.exists && userSnap.data().fcmTokens) {
                    fcmTokens.push(...userSnap.data().fcmTokens);
                }
            }

            if (fcmTokens.length === 0) {
                functions.logger.log("No FCM tokens found for eligible donors.");
                return null;
            }

            // 6. Send targeted notifications via FCM
            const payload = {
                notification: {
                    title: `Urgent Blood Request: ${bloodType}`,
                    body: `A patient at ${request.hospitalName} in your city needs your help.`,
                    // You can add more data to handle clicks in your app
                    // click_action: `https://your-app-url/requests/${context.params.requestId}`
                },
            };

            const response = await admin.messaging().sendToDevice(fcmTokens, payload);
            functions.logger.log(`Successfully sent ${response.successCount} messages.`);
            return response;
        } catch (error) {
            functions.logger.error("Error matching donors and sending notifications:", error);
            return null;
        }
    });