<script setup>
import DashboardView from '@/components/DashboardView.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const goNextPage = () => {
  router.push('/householdprofile')
}
</script>

<template>
  <DashboardView>
    <!-- FULL BACKGROUND WRAPPER -->
    <div class="home-bg d-flex align-items-center justify-content-start">
      <div class="content text-white mb-3 text-start ms-5">
        <h1 class="fw-bold">Buenavista HealthSync</h1>
        <p>Securing Health Data, Transforming Healthcare for All</p>
        <button 
          class="btn footer-btn mt-2" 
          data-bs-toggle="modal" 
          data-bs-target="#learnMoreModal"
        >
          Learn More
        </button>
      </div>
       <button class="arrow-btn next-btn" @click="goNextPage">❯</button>
    </div>

    <!-- Modal -->
    <div
      class="modal fade"
      id="learnMoreModal"
      tabindex="-1"
      aria-labelledby="learnMoreLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content shadow-lg border-0 rounded-4" style="max-width: 90vw;">
          <!-- Custom Header -->
          <div class="modal-header custom-modal-header text-white rounded-top-4">
            <h5 class="modal-title fw-bold" id="learnMoreLabel">Buenavista HealthSync</h5>
            <button
              type="button"
              class="btn-close btn-close-white"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>

          <div class="modal-body p-4">
            <!-- What is Section -->
            <section class="mb-4">
              <h5 class="fw-bold">What is Buenavista HealthSync?</h5>
              <p>
                <strong>Buenavista HealthSync (BHS)</strong> is an innovative digital health
                platform aimed at transforming barangay healthcare services. It allows for the
                secure online input and storage of community health records while archiving past
                records for easy retrieval. Health workers gain real-time access to critical data,
                improving efficiency and the quality of care in the community.
              </p>
            </section>

            <!-- How It Works -->
            <section class="mb-4">
              <h5 class="fw-bold">How It Works</h5>
              <ul class="list-group list-group-flush">
                <li class="list-group-item">Sign Up & Access: Secure login with role-based permissions.</li>
                <li class="list-group-item">Easy Data Entry: Input through simple, accurate forms.</li>
                <li class="list-group-item">Real-Time Access: Instant availability of community data.</li>
                <li class="list-group-item">Record Management: Easily update records.</li>
                <li class="list-group-item">Archiving: Archived records for easy tracking.</li>
                <li class="list-group-item">Reports: View and generate health insights.</li>
                <li class="list-group-item">Privacy: Encrypted, compliant, secure data handling.</li>
              </ul>
            </section>

            <!-- Mission & Vision -->
            <section class="mb-4">
              <h5 class="fw-bold">Mission & Vision</h5>
              <p>
                <strong>Mission:</strong> To empower barangay healthcare workers with a secure,
                efficient platform for managing community health data and improving service
                delivery.
              </p>
              <p>
                <strong>Vision:</strong> To be the leading digital health platform for barangays,
                promoting data-driven, accessible, and sustainable healthcare through innovative
                technology.
              </p>
            </section>

            <!-- Key Features -->
            <section>
              <h5 class="fw-bold">Key Features</h5>
              <div class="row">
                <div class="col-md-6">
                  <ul class="list-unstyled">
                    <li>✅ Secure Data Entry</li>
                    <li>✅ Digital Record Storage</li>
                    <li>✅ Real-Time Access</li>
                  </ul>
                </div>
                <div class="col-md-6">
                  <ul class="list-unstyled">
                    <li>✅ Smart Archiving</li>
                    <li>✅ Reports & Analytics</li>
                    <li>✅ Role-Based Access</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.home-bg {
  background: url('/images/bg.jpg') no-repeat center center;
  background-size: cover;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.content {
  max-width: 720px;
  transform: translateX(20%); /* move content 20% to the right */
}

.content h1 {
  font-size: 3.2rem; /* make the h1 larger */
  line-height: 1.05;
}

.content p {
  font-size: 1.15rem; /* slightly larger paragraph */
  margin-top: 0.6rem;
}

@media (max-width: 768px) {
  .content {
    transform: none;
    margin-left: 1rem;
    margin-right: 1rem;
    text-align: center;
  }

  .content h1 {
    font-size: 2.2rem;
  }

  .content p {
    font-size: 1rem;
  }
}

.arrow-btn {
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  font-size: 2.5rem;
  font-weight: bold;
  width: 65px;
  height: 65px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
}
.arrow-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
.next-btn {
  position: absolute;
  right: 20px;
}
.footer-btn {
  background-color: #5b841e;
  border-color: #5b841e;
  color: #fff;
  font-weight: 500;
}

.footer-btn:hover {
  background-color: #466a17; 
  border-color: #466a17;
  color: #fff;
}

/* Custom Modal Header */
.custom-modal-header {
  background-color: #5b841e; 
}
</style>
