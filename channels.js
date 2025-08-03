// Rezziter - Channel Management JavaScript

// Initialize Supabase client
// NOTE: These are public keys and are safe to expose in frontend code
// Replace these placeholder values with your actual Supabase project credentials
const SUPABASE_URL = 'https://ifdmncyrdvfxkeyzwcgr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZG1uY3lyZHZmeGtleXp3Y2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMDM5NjMsImV4cCI6MjA2OTc3OTk2M30.B6h3TVKkRYW637P-NfZio_0vCQWEtN70-Z5UA_H26uE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Load and display all unique channels from the messages table
 */
async function loadChannels() {
    const channelListDiv = document.getElementById('channel-list');
    
    // Show loading message
    channelListDiv.innerHTML = '<div class="message-item"><p>Loading...</p></div>';
    
    try {
        // Fetch all channel_id and channel_name pairs from messages table
        const { data, error } = await supabase
            .from('messages')
            .select('channel_id, channel_name');
        
        if (error) {
            console.error('Error fetching channels:', error);
            channelListDiv.innerHTML = '<div class="message-item"><p>Error loading channels.</p></div>';
            return;
        }
        
        // Fetch existing tags from channels table
        const { data: channelTags, error: tagsError } = await supabase
            .from('channels')
            .select('channel_id, tags');
        
        if (tagsError) {
            console.error('Error fetching channel tags:', tagsError);
            // Continue without tags rather than failing completely
        }
        
        // Create a Map to store existing tags by channel_id
        const tagsMap = new Map();
        if (channelTags) {
            channelTags.forEach(row => {
                tagsMap.set(row.channel_id, row.tags || []);
            });
        }
        
        // Create a Map to get unique channels by channel_id
        const channelMap = new Map();
        data.forEach(row => {
            if (!channelMap.has(row.channel_id)) {
                channelMap.set(row.channel_id, {
                    id: row.channel_id,
                    name: row.channel_name
                });
            }
        });
        
        // Convert Map to array and sort by channel name
        const uniqueChannels = Array.from(channelMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        
        // Clear loading message
        channelListDiv.innerHTML = '';
        
        // Render each channel
        uniqueChannels.forEach(channel => {
            const channelDiv = document.createElement('div');
            channelDiv.className = 'message-item';
            
            // Get existing tags for this channel
            const existingTags = tagsMap.get(channel.id) || [];
            const tagsValue = existingTags.join(', ');
            
            channelDiv.innerHTML = `
                <h2>${channel.name}</h2>
                <div style="margin: 10px 0;">
                    <label for="tags-${channel.id}">Tags:</label>
                    <input type="text" id="tags-${channel.id}" value="${tagsValue}" placeholder="Enter tags separated by commas (e.g., news, tech)" style="width: 300px; margin-left: 10px; padding: 5px;">
                </div>
                <div style="margin: 10px 0;">
                    <button class="pagination-btn" onclick="handleTagUpdate(${channel.id}, '${channel.name.replace(/'/g, "\\'")}')">Save Tags</button>
                    <button class="pagination-btn" style="background-color: #ef4444; margin-left: 10px;" onclick="handleCleanup(${channel.id}, '${channel.name.replace(/'/g, "\\'")}')">Clean Up</button>
                </div>
            `;
            
            channelListDiv.appendChild(channelDiv);
        });
        
    } catch (error) {
        console.error('Unexpected error:', error);
        channelListDiv.innerHTML = '<div class="message-item"><p>Unexpected error occurred.</p></div>';
    }
}

/**
 * Handle updating tags for a specific channel
 * @param {number} channelId - The channel ID to update tags for
 * @param {string} channelName - The channel name for the database record
 */
async function handleTagUpdate(channelId, channelName) {
    try {
        // Find the tag input element
        const tagsInput = document.getElementById(`tags-${channelId}`);
        if (!tagsInput) {
            alert('Error: Could not find tag input field.');
            return;
        }
        
        // Read and process the tag string
        const tagsString = tagsInput.value;
        const tagsArray = tagsString
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        
        // Upsert the record into the channels table
        const { error } = await supabase
            .from('channels')
            .upsert({
                channel_id: channelId,
                channel_name: channelName,
                tags: tagsArray
            }, { onConflict: 'channel_id' });
        
        if (error) {
            console.error('Error saving tags:', error);
            alert(`Failed to save tags for "${channelName}". Error: ${error.message}`);
        } else {
            alert(`Successfully saved tags for "${channelName}".`);
        }
    } catch (error) {
        console.error('Unexpected error saving tags:', error);
        alert(`Unexpected error occurred while saving tags for "${channelName}". Please try again.`);
    }
}

/**
 * Save tags for a specific channel (legacy function - calls handleTagUpdate)
 * @param {number} channelId - The channel ID to save tags for
 */
function saveTags(channelId) {
    // This function is kept for backwards compatibility
    // Find the channel name from the current display
    const channelElement = document.querySelector(`#tags-${channelId}`);
    const channelName = channelElement ? 
        channelElement.closest('.message-item').querySelector('h2').textContent : 
        `Channel ${channelId}`;
    
    handleTagUpdate(channelId, channelName);
}

/**
 * Handle cleanup of messages for a specific channel
 * @param {number} channelId - The channel ID to clean up
 * @param {string} channelName - The channel name for the confirmation dialog
 */
async function handleCleanup(channelId, channelName) {
    // Show confirmation dialog with channel name and warning
    const confirmed = confirm(
        `Are you sure you want to delete all messages from "${channelName}"?\n\n` +
        `This action is PERMANENT and CANNOT be undone.\n\n` +
        `All messages from this channel will be permanently removed from the database.`
    );
    
    if (!confirmed) {
        return; // User cancelled the operation
    }
    
    try {
        // Delete all messages for this channel
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('channel_id', channelId);
        
        if (error) {
            console.error('Error deleting messages:', error);
            alert(`Failed to delete messages from "${channelName}". Error: ${error.message}`);
        } else {
            alert(`Successfully deleted all messages from "${channelName}".`);
            // Optionally reload the channels to refresh the display
            loadChannels();
        }
    } catch (error) {
        console.error('Unexpected error during cleanup:', error);
        alert(`Unexpected error occurred while deleting messages from "${channelName}". Please try again.`);
    }
}

/**
 * Clean up channel (legacy function - calls handleCleanup)
 * @param {number} channelId - The channel ID to clean up
 */
function cleanUpChannel(channelId) {
    // This function is kept for backwards compatibility
    // Find the channel name from the current display
    const channelElement = document.querySelector(`#tags-${channelId}`);
    const channelName = channelElement ? 
        channelElement.closest('.message-item').querySelector('h2').textContent : 
        `Channel ${channelId}`;
    
    handleCleanup(channelId, channelName);
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', loadChannels);
