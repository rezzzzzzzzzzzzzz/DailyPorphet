// Rezziter - Frontend JavaScript

// Initialize Supabase client
// NOTE: These are public keys and are safe to expose in frontend code
// Replace these placeholder values with your actual Supabase project credentials
const SUPABASE_URL = 'https://ifdmncyrdvfxkeyzwcgr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZG1uY3lyZHZmeGtleXp3Y2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMDM5NjMsImV4cCI6MjA2OTc3OTk2M30.B6h3TVKkRYW637P-NfZio_0vCQWEtN70-Z5UA_H26uE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Pagination state
let currentPage = 1;
let pageSize = 20;
let totalMessages = 0;
let currentChannelFilter = 'all';

/**
 * Render messages to the page
 * @param {Array} messages - Array of message objects from Supabase
 */
function renderMessages(messages) {
    const messageFeed = document.getElementById('message-feed');
    
    // Clear existing content
    messageFeed.innerHTML = '';
    
    // If no messages, show "Nothing to Show"
    if (!messages || messages.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'Nothing to Show';
        emptyMessage.className = 'empty-state';
        messageFeed.appendChild(emptyMessage);
        return;
    }
    
    // Create messages
    messages.forEach(message => {
        // Create message container
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-item';
        
        // Format timestamp (convert ISO string to readable format)
        const timestamp = new Date(message.sent_at).toLocaleString();
        
        // Create header with timestamp and channel name
        const header = document.createElement('p');
        header.innerHTML = `<strong>[${timestamp}] - ${message.channel_name}:</strong>`;
        header.className = 'message-header';
        
        // Create message text
        const messageText = document.createElement('p');
        messageText.textContent = message.message_text;
        messageText.className = 'message-text';
        
        // Append header and text to message container
        messageDiv.appendChild(header);
        messageDiv.appendChild(messageText);
        
        // Handle media if present
        if (message.media_url) {
            const mediaContainer = document.createElement('div');
            mediaContainer.className = 'message-media';
            
            // Check if media is an image
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const isImage = imageExtensions.some(ext => 
                message.media_url.toLowerCase().endsWith(ext)
            );
            
            if (isImage) {
                // Create image element
                const img = document.createElement('img');
                img.src = message.media_url;
                img.alt = 'Message media';
                img.className = 'message-image';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.borderRadius = '0.5rem';
                img.style.marginTop = '0.5rem';
                
                // Add error handling for broken images
                img.onerror = function() {
                    this.style.display = 'none';
                    const errorText = document.createElement('p');
                    errorText.textContent = 'Image could not be loaded';
                    errorText.className = 'media-error';
                    mediaContainer.appendChild(errorText);
                };
                
                mediaContainer.appendChild(img);
            } else {
                // Create download link for other media types
                const mediaLink = document.createElement('a');
                mediaLink.href = message.media_url;
                mediaLink.textContent = 'Download Media';
                mediaLink.className = 'media-link';
                mediaLink.target = '_blank';
                mediaLink.rel = 'noopener noreferrer';
                mediaLink.style.color = '#60a5fa';
                mediaLink.style.textDecoration = 'underline';
                mediaLink.style.display = 'inline-block';
                mediaLink.style.marginTop = '0.5rem';
                
                mediaContainer.appendChild(mediaLink);
            }
            
            messageDiv.appendChild(mediaContainer);
        }
        
        // Add message to feed
        messageFeed.appendChild(messageDiv);
    });
    
    console.log(`✅ Rendered ${messages.length} messages to the page`);
}

/**
 * Show loading indicator
 */
function showLoading() {
    const messageFeed = document.getElementById('message-feed');
    messageFeed.innerHTML = '<p class="loading">Loading...</p>';
}

/**
 * Populate the channel filter dropdown with unique channel names
 */
async function populateChannelFilter() {
    try {
        console.log('🔄 Populating channel filter...');
        
        // Fetch all unique channel names from the database
        const { data, error } = await supabase
            .from('messages')
            .select('channel_name')
            .order('channel_name');
        
        if (error) {
            console.error('❌ Error fetching channel names:', error);
            return;
        }
        
        // Get unique channel names (client-side deduplication)
        const uniqueChannels = [...new Set(data.map(row => row.channel_name))].sort();
        
        console.log(`✅ Found ${uniqueChannels.length} unique channels`);
        
        // Get the select element
        const channelSelect = document.getElementById('channel-filter');
        
        // Clear existing options except "All Channels"
        while (channelSelect.children.length > 1) {
            channelSelect.removeChild(channelSelect.lastChild);
        }
        
        // Add option for each unique channel
        uniqueChannels.forEach(channelName => {
            const option = document.createElement('option');
            option.value = channelName;
            option.textContent = channelName;
            channelSelect.appendChild(option);
        });
        
        console.log('✅ Channel filter populated successfully');
        
    } catch (error) {
        console.error('❌ Unexpected error populating channel filter:', error);
    }
}

/**
 * Update pagination controls based on current state
 */
function updatePaginationControls() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    
    // Update page info
    const totalPages = Math.ceil(totalMessages / pageSize);
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    // Update button states
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
    
    console.log(`📄 Pagination: Page ${currentPage}/${totalPages}, ${totalMessages} total messages`);
}

/**
 * Get total message count for pagination
 * @param {string} channelName - Optional channel name filter
 */
async function getTotalMessageCount(channelName = null) {
    try {
        let query = supabase
            .from('messages')
            .select('*', { count: 'exact', head: true });
        
        // Apply channel filter if specified
        if (channelName && channelName !== 'all') {
            query = query.eq('channel_name', channelName);
        }
        
        const { count, error } = await query;
        
        if (error) {
            console.error('❌ Error getting message count:', error);
            return 0;
        }
        
        return count || 0;
    } catch (error) {
        console.error('❌ Unexpected error getting message count:', error);
        return 0;
    }
}

/**
 * Fetch messages with pagination and optional channel filtering
 * @param {number} page - Page number (1-based)
 * @param {number} size - Number of messages per page
 * @param {string} channelName - Optional channel name filter
 */
async function fetchMessages(page = currentPage, size = pageSize, channelName = currentChannelFilter) {
    try {
        const filterText = channelName && channelName !== 'all' ? ` (filtered by: ${channelName})` : '';
        console.log(`🔄 Fetching messages - Page ${page}, Size ${size}${filterText}...`);
        
        // Show loading indicator
        showLoading();
        
        // Get total count for pagination (with same filter)
        totalMessages = await getTotalMessageCount(channelName);
        
        // Calculate offset for pagination (Supabase uses 0-based indexing)
        const offset = (page - 1) * size;
        const rangeEnd = offset + size - 1;
        
        // Build query with optional channel filter
        let query = supabase
            .from('messages')
            .select('*')
            .order('sent_at', { ascending: false });
        
        // Apply channel filter if specified
        if (channelName && channelName !== 'all') {
            query = query.eq('channel_name', channelName);
        }
        
        // Apply pagination
        query = query.range(offset, rangeEnd);
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error fetching messages:', error);
            
            // Show error message to user
            const messageFeed = document.getElementById('message-feed');
            messageFeed.innerHTML = '<p class="error">Failed to load messages. Please try again later.</p>';
            return;
        }
        
        console.log('✅ Successfully fetched messages:', data);
        console.log(`📊 Retrieved ${data.length} messages (Page ${page}/${Math.ceil(totalMessages / size)})`);
        
        // Log each message for debugging
        data.forEach((message, index) => {
            console.log(`Message ${index + 1}:`, {
                id: message.message_id,
                channel: message.channel_name,
                text: message.message_text.substring(0, 100) + '...',
                sent_at: message.sent_at
            });
        });
        
        // Update current state
        currentPage = page;
        pageSize = size;
        currentChannelFilter = channelName;
        
        // Render messages to the page
        renderMessages(data);
        
        // Update pagination controls
        updatePaginationControls();
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        
        // Show error message to user
        const messageFeed = document.getElementById('message-feed');
        messageFeed.innerHTML = '<p class="error">An unexpected error occurred. Please check the console for details.</p>';
    }
}

/**
 * Go to previous page
 */
function goToPreviousPage() {
    if (currentPage > 1) {
        fetchMessages(currentPage - 1, pageSize, currentChannelFilter);
    }
}

/**
 * Go to next page
 */
function goToNextPage() {
    const totalPages = Math.ceil(totalMessages / pageSize);
    if (currentPage < totalPages) {
        fetchMessages(currentPage + 1, pageSize, currentChannelFilter);
    }
}

/**
 * Change page size
 */
function changePageSize(newSize) {
    const newSizeNum = parseInt(newSize);
    if (newSizeNum && newSizeNum > 0) {
        // Reset to page 1 when changing page size
        fetchMessages(1, newSizeNum, currentChannelFilter);
    }
}

/**
 * Handle channel filter change
 */
function handleChannelFilterChange() {
    const channelSelect = document.getElementById('channel-filter');
    const selectedChannel = channelSelect.value;
    
    console.log(`🔄 Channel filter changed to: ${selectedChannel}`);
    
    // Reset to page 1 when filter changes
    currentPage = 1;
    
    // Fetch messages with new filter
    fetchMessages(1, pageSize, selectedChannel);
}

/**
 * Setup pagination and filter event listeners
 */
function setupEventListeners() {
    // Previous button
    const prevBtn = document.getElementById('prev-btn');
    prevBtn.addEventListener('click', goToPreviousPage);
    
    // Next button
    const nextBtn = document.getElementById('next-btn');
    nextBtn.addEventListener('click', goToNextPage);
    
    // Page size selector
    const pageSizeSelect = document.getElementById('page-size-select');
    pageSizeSelect.addEventListener('change', (event) => {
        changePageSize(event.target.value);
    });
    
    // Channel filter
    const channelFilter = document.getElementById('channel-filter');
    channelFilter.addEventListener('change', handleChannelFilterChange);
    
    console.log('✅ Event listeners setup complete');
}

/**
 * Test Supabase connection
 * This function checks if we can connect to Supabase successfully
 */
async function testConnection() {
    try {
        console.log('🔧 Testing Supabase connection...');
        
        const { data, error } = await supabase
            .from('messages')
            .select('count', { count: 'exact' })
            .limit(1);
        
        if (error) {
            console.error('❌ Connection test failed:', error);
            return false;
        }
        
        console.log('✅ Supabase connection successful!');
        console.log(`📊 Total messages in database: ${data.length > 0 ? 'Connected' : 'Empty or no access'}`);
        return true;
        
    } catch (error) {
        console.error('❌ Connection test error:', error);
        return false;
    }
}

/**
 * Initialize the application when the page loads
 */
async function initializeApp() {
    console.log('🚀 Initializing Rezziter frontend...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Test connection first
    const connectionOk = await testConnection();
    
    if (connectionOk) {
        // Populate channel filter dropdown
        await populateChannelFilter();
        
        // Fetch and display messages with pagination
        await fetchMessages();
    } else {
        console.error('❌ Cannot proceed - Supabase connection failed');
        console.log('💡 Make sure to update SUPABASE_URL and SUPABASE_ANON_KEY in main.js');
    }
}

// Run initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Also run if the script loads after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
