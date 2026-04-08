/**
 * Public Walk Tracking API
 * Returns walk data + GPS tracking points for the public tracking page.
 * No authentication required — walk UUID acts as the security token.
 */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const walkId = req.query.walkId;
  if (!walkId || !/^[0-9a-f-]{36}$/i.test(walkId)) {
    return res.status(400).json({ error: 'Invalid or missing walkId' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://niysrippazlkpvdkzepp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    // Fetch walk record
    const { data: walk, error: walkErr } = await supabase
      .from('walks')
      .select('id, walker_id, client_id, service, pet_name, status, start_time, end_time, route_summary')
      .eq('id', walkId)
      .single();

    if (walkErr || !walk) {
      return res.status(404).json({ error: 'Walk not found' });
    }

    // Get walker name
    const { data: walkerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', walk.walker_id)
      .maybeSingle();

    const walkerName = walkerProfile ? walkerProfile.full_name : 'Your walker';

    // For in_progress walks, fetch live tracking points
    let trackingPoints = [];
    if (walk.status === 'in_progress') {
      const { data: points } = await supabase
        .from('tracking_points')
        .select('lat, lng, recorded_at')
        .eq('walk_id', walkId)
        .order('recorded_at', { ascending: true });
      trackingPoints = points || [];
    } else if (walk.route_summary && walk.route_summary.length > 0) {
      // For completed walks, use the stored route summary
      trackingPoints = walk.route_summary.map(p => ({
        lat: p.lat,
        lng: p.lng,
        recorded_at: p.t || null
      }));
    }

    // Calculate distance if we have points
    let distance = null;
    if (trackingPoints.length >= 2) {
      let totalMeters = 0;
      for (let i = 1; i < trackingPoints.length; i++) {
        const R = 6371000;
        const dLat = (trackingPoints[i].lat - trackingPoints[i-1].lat) * Math.PI / 180;
        const dLng = (trackingPoints[i].lng - trackingPoints[i-1].lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(trackingPoints[i-1].lat * Math.PI / 180) * Math.cos(trackingPoints[i].lat * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
        totalMeters += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }
      const miles = totalMeters / 1609.34;
      distance = miles >= 0.1 ? miles.toFixed(1) + ' mi' : null;
    }

    // Calculate elapsed time
    const startMs = new Date(walk.start_time).getTime();
    const endMs = walk.end_time ? new Date(walk.end_time).getTime() : Date.now();
    const elapsedMin = Math.floor((endMs - startMs) / 60000);

    return res.status(200).json({
      walk: {
        id: walk.id,
        status: walk.status,
        service: walk.service,
        petName: walk.pet_name,
        walkerName: walkerName,
        startTime: walk.start_time,
        endTime: walk.end_time || null,
        elapsedMinutes: elapsedMin,
        distance: distance,
      },
      trackingPoints: trackingPoints,
    });
  } catch (err) {
    console.error('[walk-tracking] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
