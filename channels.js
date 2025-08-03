// Rezziter - Channel Management JavaScript

// Initialize Supabase client
const SUPABASE_URL = 'https://ifdmncyrdvfxkeyzwcgr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZG1uY3lyZHZmeGtleXp3Y2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMDM5NjMsImV4cCI6MjA2OTc3OTk2M30.B6h3TVKkRYW637P-NfZio_0vCQWEtN70-Z5UA_H26uE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- STATE MANAGEMENT ---
let allChannelsData = []; // Cache for holding channel data to avoid re-fetching
let currentSort = 'name'; // 'name' or 'count'

// --- DASHBOARD STATS ---
async function loadDashboardStats() {
    const statsContainer = document.getElementById('dashboard-stats');
    try {
        const [totalMessagesRes, uniqueChannelsRes, recentMessagesRes] = await Promise.all([
            supabase.from('messages').select('*', { count: 'exact', head: true }),
            supabase.rpc('get_channel_stats'), // Use our RPC to get unique channel count easily
            supabase.from('messages').select('*', { count: 'exact', head: true }).gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ]);

        const totalMessagesCount = totalMessagesRes.count;
        const uniqueChannelCount = uniqueChannelsRes.data.length;
        const recentMessagesCount = recentMessagesRes.count;

        statsContainer.innerHTML = `
            <div style="display: flex; justify-content: space-around; text-align: center; flex-wrap: wrap; gap: 1rem;">
                <div><h3 class="dashboard-stat-number">${totalMessagesCount.toLocaleString()}</h3><p class="dashboard-stat-label">Total Messages</p></div>
                <div><h3 class="dashboard-stat-number">${uniqueChannelCount.toLocaleString()}</h3><p class="dashboard-stat-label">Unique Channels</p></div>
                <div><h3 class="dashboard-stat-number">${recentMessagesCount.toLocaleString()}</h3><p class="dashboard-stat-label">Messages in Last 24h</p></div>
            </div>`;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        statsContainer.innerHTML = '<p class="error">Could not load dashboard stats.</p>';
    }
}

// --- CHANNEL LIST RENDERING ---
function renderChannelList() {
    const gridContainer = document.getElementById('channel-grid');
    gridContainer.innerHTML = ''; // Clear previous content

    // Sort the cached data based on the current sort state
    const sortedChannels = [...allChannelsData].sort((a, b) => {
        if (currentSort === 'name') {
            return a.channel_name.localeCompare(b.channel_name);
        } else { // 'count'
            return b.message_count - a.message_count;
        }
    });

    if (sortedChannels.length === 0) {
        gridContainer.innerHTML = '<p class="empty-state">No channels found.</p>';
        return;
    }

    // Render each channel as a new card
    sortedChannels.forEach(channel => {
        const card = document.createElement('div');
        card.className = 'channel-card';
        const existingTags = channel.tags ? channel.tags.join(', ') : '';
        const lastMessageDate = new Date(channel.last_message_sent_at).toLocaleDateString();

        card.innerHTML = `
            <div class="channel-card-header">
                <h2>${channel.channel_name}</h2>
                <div class="channel-card-stats">
                    <span>${channel.message_count.toLocaleString()} Messages</span> | <span>Last post: ${lastMessageDate}</span>
                </div>
            </div>
            <div class="channel-card-tags">
                <input type="text" id="tags-${channel.channel_id}" value="${existingTags}" placeholder="e.g., news, tech">
            </div>
            <div class="channel-card-actions">
                <button class="pagination-btn" onclick="handleTagUpdate(${channel.channel_id}, '${channel.channel_name.replace(/'/g, "\\'")}')">Save Tags</button>
                <button class="pagination-btn" style="background-color: #ef4444;" onclick="handleCleanup(${channel.channel_id}, '${channel.channel_name.replace(/'/g, "\\'")}')">Clean Up</button>
            </div>
        `;
        gridContainer.appendChild(card);
    });
}

async function loadChannels() {
    const gridContainer = document.getElementById('channel-grid');
    gridContainer.innerHTML = '<p class="loading">Loading Channels...</p>';

    try {
        // 1. Fetch channel stats using the RPC
        const { data: statsData, error: statsError } = await supabase.rpc('get_channel_stats');
        if (statsError) throw statsError;

        // 2. Fetch tags separately
        const { data: tagsData, error: tagsError } = await supabase.from('channels').select('channel_id, tags');
        if (tagsError) throw tagsError;
        const tagsMap = new Map(tagsData.map(t => [t.channel_id, t.tags]));

        // 3. Combine the data
        allChannelsData = statsData.map(stat => ({
            ...stat,
            tags: tagsMap.get(stat.channel_id) || []
        }));

        // 4. Render the list for the first time
        renderChannelList();

    } catch (error) {
        console.error('Error loading channel list:', error);
        gridContainer.innerHTML = '<p class="error">Could not load channel list.</p>';
    }
}

// --- EVENT HANDLERS ---
async function handleTagUpdate(channelId, channelName) {
    const tagsInput = document.getElementById(`tags-${channelId}`);
    const tagsArray = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);

    const { error } = await supabase
        .from('channels')
        .upsert({ channel_id: channelId, channel_name: channelName, tags: tagsArray }, { onConflict: 'channel_id' });

    if (error) {
        alert(`Error saving tags: ${error.message}`);
    } else {
        alert('Tags saved successfully!');
        // Update local cache to reflect change without a full reload
        const channelInCache = allChannelsData.find(c => c.channel_id === channelId);
        if (channelInCache) {
            channelInCache.tags = tagsArray;
        }
    }
}

async function handleCleanup(channelId, channelName) {
    if (confirm(`Are you sure you want to delete ALL messages from "${channelName}"? This action cannot be undone.`)) {
        const { error } = await supabase.from('messages').delete().eq('channel_id', channelId);

        if (error) {
            alert(`Error deleting messages: ${error.message}`);
        } else {
            alert('All messages for this channel have been deleted.');
            // Reload all data to reflect the new counts
            loadChannels();
            loadDashboardStats();
        }
    }
}

function setupSortControls() {
    const sortByNameBtn = document.getElementById('sort-by-name');
    const sortByCountBtn = document.getElementById('sort-by-count');

    sortByNameBtn.addEventListener('click', () => {
        currentSort = 'name';
        sortByNameBtn.classList.add('active');
        sortByCountBtn.classList.remove('active');
        renderChannelList();
    });

    sortByCountBtn.addEventListener('click', () => {
        currentSort = 'count';
        sortByCountBtn.classList.add('active');
        sortByNameBtn.classList.remove('active');
        renderChannelList();
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    loadChannels();
    setupSortControls();
});
