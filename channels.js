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
    try {
        console.log('🔄 Loading dashboard stats...');
        
        // Update stat cards to show loading state
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => card.classList.add('loading-card'));
        
        // Fetch all stats in parallel for better performance
        const [totalMessagesRes, uniqueChannelsRes, recentMessagesRes] = await Promise.all([
            supabase.from('messages').select('*', { count: 'exact', head: true }),
            supabase.rpc('get_channel_stats'), // Use our RPC to get unique channel count easily
            supabase.from('messages').select('*', { count: 'exact', head: true }).gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ]);

        const totalMessagesCount = totalMessagesRes.count || 0;
        const uniqueChannelCount = uniqueChannelsRes.data?.length || 0;
        const recentMessagesCount = recentMessagesRes.count || 0;

        console.log('✅ Dashboard stats loaded:', {
            totalMessages: totalMessagesCount,
            uniqueChannels: uniqueChannelCount,
            recentMessages: recentMessagesCount
        });

        // Update the stat cards with real data
        const statNumbers = document.querySelectorAll('.stat-number');
        const statData = [
            totalMessagesCount.toLocaleString(),
            uniqueChannelCount.toLocaleString(),
            recentMessagesCount.toLocaleString()
        ];
        
        // Animate number updates
        statNumbers.forEach((numberElement, index) => {
            if (statData[index]) {
                // Remove loading state
                numberElement.closest('.stat-card').classList.remove('loading-card');
                
                // Animate the number change
                animateNumber(numberElement, statData[index]);
            }
        });
        
    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
        
        // Show error state on all cards
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(numberElement => {
            numberElement.closest('.stat-card').classList.remove('loading-card');
            numberElement.textContent = 'Error';
            numberElement.style.color = '#f87171';
        });
    }
}

// Animate number changes for a smooth effect
function animateNumber(element, finalValue) {
    const duration = 1000; // 1 second
    const startTime = performance.now();
    const startValue = 0;
    
    // Parse the final value (remove commas for calculation)
    const finalNum = parseInt(finalValue.replace(/,/g, ''));
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (finalNum - startValue) * easeProgress);
        
        element.textContent = currentValue.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = finalValue; // Ensure final value is exact
        }
    }
    
    requestAnimationFrame(updateNumber);
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

async function handleClearAllMessages() {
    const confirmText = "⚠️ DANGER: This will delete ALL messages from ALL channels!\n\nThis action is irreversible and will permanently remove all your data.\n\nType 'DELETE ALL' to confirm:";
    const userInput = prompt(confirmText);
    
    if (userInput === 'DELETE ALL') {
        try {
            console.log('🗑️ Starting complete database cleanup...');
            
            // Show loading state on the clear button
            const clearBtn = document.getElementById('clear-all-btn');
            const originalText = clearBtn.innerHTML;
            clearBtn.innerHTML = '<span class="clear-icon">⏳</span>Deleting...';
            clearBtn.disabled = true;
            
            // Delete all messages
            const { error } = await supabase
                .from('messages')
                .delete()
                .neq('message_id', 0); // This deletes all rows (neq with impossible value)
            
            if (error) {
                console.error('❌ Error during cleanup:', error);
                alert(`Error deleting messages: ${error.message}`);
            } else {
                console.log('✅ All messages deleted successfully');
                alert('🗑️ All messages have been permanently deleted from the database.');
                
                // Reload all data
                await Promise.all([loadChannels(), loadDashboardStats()]);
            }
            
            // Restore button state
            clearBtn.innerHTML = originalText;
            clearBtn.disabled = false;
            
        } catch (error) {
            console.error('❌ Unexpected error during cleanup:', error);
            alert('An unexpected error occurred during cleanup. Please check the console.');
            
            // Restore button state
            const clearBtn = document.getElementById('clear-all-btn');
            clearBtn.innerHTML = '<span class="clear-icon">🗑️</span>Clear All Messages';
            clearBtn.disabled = false;
        }
    } else if (userInput !== null) {
        alert('Cleanup cancelled. You must type "DELETE ALL" exactly to confirm.');
    }
}

function setupSortControls() {
    const sortByNameBtn = document.getElementById('sort-by-name');
    const sortByCountBtn = document.getElementById('sort-by-count');
    const clearAllBtn = document.getElementById('clear-all-btn');

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
    
    // Add clear all button functionality
    clearAllBtn.addEventListener('click', handleClearAllMessages);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    loadChannels();
    setupSortControls();
});
