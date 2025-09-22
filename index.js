const functions = require("firebase-functions");
const admin = require("firebase-admin");
const geolib = require("geolib");

admin.initializeApp();

const db = admin.firestore();

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

const scoringWeights = {
    perfectMatch: 50,
    proximity: 30,
    recency: 20,
};

const MAX_DISTANCE_FOR_SCORING = 25000;

exports.onRequestCreate = functions.firestore
    .document('requests/{requestId}')
    .onCreate(async (snap, context) => {
        const request = snap.data();
        const { bloodType, location, city, isEmergency } = request;

        functions.logger.log(`New request ${context.params.requestId} for blood type ${bloodType} in ${city}.`);

        const compatibleDonorTypes = bloodCompatibility[bloodType];
        if (!compatibleDonorTypes || compatibleDonorTypes.length === 0) {
            functions.logger.error(`Invalid blood type in request: ${bloodType}`);
            return null;
        }

        functions.logger.log(`Compatible donor types: ${compatibleDonorTypes.join(", ")}`);

        try {
            const radiusInM = isEmergency ? 50 * 1000 : 25 * 1000;

            const bounds = geolib.getBoundsOfDistance(
                { latitude: location.latitude, longitude: location.longitude },
                radiusInM
            );

            const donorsRef = db.collection('donors');

            const minDonationDate = new Date();
            minDonationDate.setDate(minDonationDate.getDate() - 56);

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

            const eligibleDonors = [];
            querySnapshot.forEach(doc => {
                const donor = doc.data();
                const distanceInM = geolib.getDistance(
                    { latitude: location.latitude, longitude: location.longitude },
                    { latitude: donor.location.latitude, longitude: donor.location.longitude }
                );
                
                if (distanceInM <= radiusInM && (!donor.lastDonationDate || donor.lastDonationDate.toDate() < minDonationDate)) {
                    const score = calculateScore(donor, request, distanceInM);
                    eligibleDonors.push({ id: doc.id, score, ...donor });
                }
            });

            if (eligibleDonors.length === 0) {
                functions.logger.log("No eligible donors found after filtering.");
                return null;
            }

            eligibleDonors.sort((a, b) => b.score - a.score);

            functions.logger.log(`Ranked ${eligibleDonors.length} potential donors.`);

            const topDonors = eligibleDonors.slice(0, 10);
            topDonors.forEach(d => {
                functions.logger.log(`  - Donor: ${d.id}, Score: ${d.score.toFixed(2)}`);
            });

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

            const payload = {
                notification: {
                    title: `Urgent Blood Request: ${bloodType}`,
                    body: `A patient at ${request.hospitalName} in your city needs your help.`,
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