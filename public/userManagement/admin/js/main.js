// add hovered class to selected list item
let list = document.querySelectorAll(".navigation li");

function activateLink() {
    list.forEach((item) => {
        item.classList.remove("hovered");
    });
    this.classList.add("hovered");
}

list.forEach((item) => item.addEventListener("mouseover", activateLink));

// Menu toggle
let toggle = document.querySelector(".toggle");
let navigation = document.querySelector(".navigation");
let main = document.querySelector(".main");

toggle.onclick = function() {
    navigation.classList.toggle("active");
    main.classList.toggle("active");
};

document.addEventListener('DOMContentLoaded', function () {
    // Extract data from cardBox and details sections
    const totalCustomers = document.querySelector('.cardBox .card:nth-child(1) .numbers').textContent;
    const totalBookings = document.querySelector('.cardBox .card:nth-child(2) .numbers').textContent;
    // Extract other relevant data as needed...
    const statusData = [];
    document.querySelectorAll('.recentOrders tbody tr').forEach(function (row) {
        const statusCell = row.querySelector('td:nth-child(10)'); // Assuming status is in the 9th column
        if (statusCell) {
            const status = statusCell.textContent.trim().toLowerCase();
            // Filter only specific statuses
            if (['pending', 'delivered', 'in progress', 'return'].includes(status)) {
                statusData.push(status);
            }
        }
    });

    // Count occurrences of each status
    const statusCount = {};
    statusData.forEach(function (status) {
        statusCount[status] = (statusCount[status] || 0) + 1;
    });

    // Define colors for each status
    const statusColors = {
        'pending': '#800080',
        'delivered': '#8de02c',
        'in progress': '#1795ce',
        'return': '#f00'
    }





    // Line Chart
    const lineChartContext = document.getElementById('lineChart');
    if (lineChartContext) {
        new Chart(lineChartContext, {
            type: 'line',
            data: {
                labels: ['Total Customers', 'Total Bookings'],
                datasets: [{
                    label: 'Statistics',
                    data: [parseInt(totalCustomers), parseInt(totalBookings)],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true
            }
        });
    } 





 

    // Doughnut Chart
    const doughnutContext = document.getElementById('doughnut');
    if (doughnutContext) {
        const labels = Object.keys(statusCount);
        const data = Object.values(statusCount);
        const backgroundColors = labels.map(status => statusColors[status]);

        new Chart(doughnutContext, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Orders by Status',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true
            }
        });
    }
});