// Channels management functionality for Rezziter

// Initialize Supabase client (same as main.js)
const SUPABASE_URL = 'https://ifdmncyrdvfxkeyzwcgr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZG1uY3lyZHZmeGtleXp3Y2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMDM5NjMsImV4cCI6MjA2OTc3OTk2M30.B6h3TVKkRYW637P-NfZio_0vCQWEtN70-Z5UA_H26uE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Get channel statistics
 */
async function getChannelStats() {
    try {
        // Get unique channels count
        const { data: channels, error: channelsError } = await supabase
            .from('messages')
            .select('channel_id, channel_name')
            .order('channel_name');

        if (channelsError) throw channelsError;

        const uniqueChannels = [...new Map(channels.map(ch => [ch.channel_id, ch])).values()];

        // Get blacklisted channels count
        const { count: blacklistedCount, error: blacklistedError } = await supabase
            .from('blacklisted_channels')
            .select('*', { count: 'exact', head: true });

        if (blacklistedError) throw blacklistedError;

        // Get total messages count
        const { count: messagesCount, error: messagesError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true });

        if (messagesError) throw messagesError;

        return {
            totalChannels: uniqueChannels.length,
            blacklistedChannels: blacklistedCount || 0,
            totalMessages: messagesCount || 0
        };

    } catch (error) {
        console.error('Error getting channel stats:', error);
        return {
            totalChannels: 0,
            blacklistedChannels: 0,
            totalMessages: 0
        };
    }
}

/**
 * Get all channels with message counts and latest message info
 */
async function getAllChannels() {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('channel_id, channel_name, sent_at')
            .order('sent_at', { ascending: false });

        if (error) throw error;

        // Group by channel and get stats
        const channelStats = {};
        
        data.forEach(message => {
            const channelId = message.channel_id;
            
            if (!channelStats[channelId]) {
                channelStats[channelId] = {
                    id: channelId,
                    name: message.channel_name,
                    messageCount: 0,
                    latestMessage: null
                };
            }
            
            channelStats[channelId].messageCount++;
            
            if (!channelStats[channelId].latestMessage || 
                new Date(message.sent_at) > new Date(channelStats[channelId].latestMessage)) {
                channelStats[channelId].latestMessage = message.sent_at;
            }
        });

        return Object.values(channelStats).sort((a, b) => b.messageCount - a.messageCount);

    } catch (error) {
        console.error('Error getting channels:', error);
        return [];
    }
}

/**
 * Get blacklisted channels
 */
async function getBlacklistedChannels() {
    try {
        const { data, error } = await supabase
            .from('blacklisted_channels')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];

    } catch (error) {
        console.error('Error getting blacklisted channels:', error);
        return [];
    }
}

/**
 * Get blacklisted keywords
 */
async function getBlacklistedKeywords() {
    try {
        const { data, error } = await supabase
            .from('blacklisted_keywords')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];

    } catch (error) {
        console.error('Error getting blacklisted keywords:', error);
        return [];
    }
}

/**
 * Add channel to blacklist
 */
async function addChannelToBlacklist(channelId, reason = '') {
    try {
        const { data, error } = await supabase
            .from('blacklisted_channels')
            .insert([
                {
                    channel_id: parseInt(channelId),
                    reason: reason.trim() || null
                }
            ]);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error('Error adding channel to blacklist:', error);
        return false;
    }
}

/**
 * Add keyword to blacklist
 */
async function addKeywordToBlacklist(keyword, reason = '') {
    try {
        const { data, error } = await supabase
            .from('blacklisted_keywords')
            .insert([
                {
                    keyword: keyword.trim().toLowerCase(),
                    reason: reason.trim() || null
                }
            ]);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error('Error adding keyword to blacklist:', error);
        return false;
    }
}

/**
 * Remove channel from blacklist
 */
async function removeChannelFromBlacklist(channelId) {
    try {
        const { error } = await supabase
            .from('blacklisted_channels')
            .delete()
            .eq('channel_id', parseInt(channelId));

        if (error) throw error;
        return true;

    } catch (error) {
        console.error('Error removing channel from blacklist:', error);
        return false;
    }
}

/**
 * Remove keyword from blacklist
 */
async function removeKeywordFromBlacklist(keyword) {
    try {
        const { error } = await supabase
            .from('blacklisted_keywords')
            .delete()
            .eq('keyword', keyword);

        if (error) throw error;
        return true;

    } catch (error) {
        console.error('Error removing keyword from blacklist:', error);
        return false;
    }
}

/**
 * Render channel statistics
 */
async function renderStats() {
    const stats = await getChannelStats();
    
    document.getElementById('total-channels').textContent = stats.totalChannels;
    document.getElementById('blacklisted-channels').textContent = stats.blacklistedChannels;
    document.getElementById('total-messages').textContent = stats.totalMessages;
}

/**
 * Render channels grid
 */
async function renderChannels() {
    const channels = await getAllChannels();
    const channelsGrid = document.getElementById('channels-grid');
    
    if (channels.length === 0) {
        channelsGrid.innerHTML = '<p class="empty-state">No channels found. Messages will appear here after collection starts.</p>';
        return;
    }
    
    channelsGrid.innerHTML = channels.map(channel => `
        <div class="channel-card">
            <div class="channel-header">
                <h3 class="channel-name">${escapeHtml(channel.name)}</h3>
                <span class="channel-id">ID: ${channel.id}</span>
            </div>
            <div class="channel-stats">
                <div class="stat">
                    <span class="stat-label">Messages:</span>
                    <span class="stat-value">${channel.messageCount}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Latest:</span>
                    <span class="stat-value">${formatDate(channel.latestMessage)}</span>
                </div>
            </div>
            <div class="channel-actions">
                <button onclick="addChannelToBlacklistFromCard(${channel.id}, '${escapeHtml(channel.name)}')" 
                        class="blacklist-btn">
                    ⚫ Blacklist
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Render blacklisted channels
 */
async function renderBlacklistedChannels() {
    const blacklistedChannels = await getBlacklistedChannels();
    const container = document.getElementById('blacklisted-channels-list');
    
    if (blacklistedChannels.length === 0) {
        container.innerHTML = '<p class="empty-state">No blacklisted channels</p>';
        return;
    }
    
    container.innerHTML = blacklistedChannels.map(channel => `
        <div class="blacklist-item">
            <div class="blacklist-info">
                <strong>Channel ID:</strong> ${channel.channel_id}<br>
                ${channel.channel_name ? `<strong>Name:</strong> ${escapeHtml(channel.channel_name)}<br>` : ''}
                ${channel.reason ? `<strong>Reason:</strong> ${escapeHtml(channel.reason)}<br>` : ''}
                <small>Added: ${formatDate(channel.created_at)}</small>
            </div>
            <button onclick="removeChannelFromBlacklistAndRefresh(${channel.channel_id})" 
                    class="remove-btn">
                ❌ Remove
            </button>
        </div>
    `).join('');
}

/**
 * Render blacklisted keywords
 */
async function renderBlacklistedKeywords() {
    const blacklistedKeywords = await getBlacklistedKeywords();
    const container = document.getElementById('blacklisted-keywords-list');
    
    if (blacklistedKeywords.length === 0) {
        container.innerHTML = '<p class="empty-state">No blacklisted keywords</p>';
        return;
    }
    
    container.innerHTML = blacklistedKeywords.map(keyword => `
        <div class="blacklist-item">
            <div class="blacklist-info">
                <strong>Keyword:</strong> "${escapeHtml(keyword.keyword)}"<br>
                ${keyword.reason ? `<strong>Reason:</strong> ${escapeHtml(keyword.reason)}<br>` : ''}
                <small>Added: ${formatDate(keyword.created_at)}</small>
            </div>
            <button onclick="removeKeywordFromBlacklistAndRefresh('${escapeHtml(keyword.keyword)}')" 
                    class="remove-btn">
                ❌ Remove
            </button>
        </div>
    `).join('');
}

/**
 * Helper functions
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
}

/**
 * Event handlers
 */
async function addChannelToBlacklistFromCard(channelId, channelName) {
    const reason = prompt(`Add "${channelName}" to blacklist?\n\nOptional reason:`);
    if (reason !== null) { // User didn't cancel
        const success = await addChannelToBlacklist(channelId, reason);
        if (success) {
            alert('Channel added to blacklist successfully!');
            refreshAll();
        } else {
            alert('Failed to add channel to blacklist. It may already be blacklisted.');
        }
    }
}

async function removeChannelFromBlacklistAndRefresh(channelId) {
    if (confirm('Remove this channel from blacklist?')) {
        const success = await removeChannelFromBlacklist(channelId);
        if (success) {
            refreshAll();
        } else {
            alert('Failed to remove channel from blacklist.');
        }
    }
}

async function removeKeywordFromBlacklistAndRefresh(keyword) {
    if (confirm(`Remove "${keyword}" from blacklist?`)) {
        const success = await removeKeywordFromBlacklist(keyword);
        if (success) {
            refreshAll();
        } else {
            alert('Failed to remove keyword from blacklist.');
        }
    }
}

/**
 * Refresh all data
 */
async function refreshAll() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('channels-grid').style.display = 'none';
    
    await Promise.all([
        renderStats(),
        renderChannels(),
        renderBlacklistedChannels(),
        renderBlacklistedKeywords()
    ]);
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('channels-grid').style.display = 'grid';
}

/**
 * Initialize page
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Set up tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active tab content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Set up form handlers
    document.getElementById('add-channel-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const channelId = document.getElementById('channel-id').value.trim();
        const reason = document.getElementById('channel-reason').value.trim();
        
        if (!channelId) return;
        
        const success = await addChannelToBlacklist(channelId, reason);
        if (success) {
            document.getElementById('add-channel-form').reset();
            renderBlacklistedChannels();
            renderStats();
            alert('Channel added to blacklist successfully!');
        } else {
            alert('Failed to add channel to blacklist. Please check the channel ID.');
        }
    });
    
    document.getElementById('add-keyword-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const keyword = document.getElementById('keyword-text').value.trim();
        const reason = document.getElementById('keyword-reason').value.trim();
        
        if (!keyword) return;
        
        const success = await addKeywordToBlacklist(keyword, reason);
        if (success) {
            document.getElementById('add-keyword-form').reset();
            renderBlacklistedKeywords();
            renderStats();
            alert('Keyword added to blacklist successfully!');
        } else {
            alert('Failed to add keyword to blacklist.');
        }
    });
    
    // Set up refresh button
    document.getElementById('refresh-btn').addEventListener('click', refreshAll);
    
    // Initial load
    await refreshAll();
});
