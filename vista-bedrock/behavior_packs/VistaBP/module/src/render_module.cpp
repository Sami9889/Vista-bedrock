#include "vista_render_module.h"
#include <cstring>
#include <mutex>

namespace Vista {

static const char* MODULE_VERSION = "1.0.0";

class RenderModule : public IRenderModule {
public:
    RenderModule() : initialized(false) {}

    bool initialize() override {
        std::lock_guard<std::mutex> lock(mutex_);
        if (initialized) return true;

        status_.push_back("[VistaRender] Module initialized v" + std::string(MODULE_VERSION));
        status_.push_back("[VistaRender] Hooked into ClientRenderSystem");
        status_.push_back("[VistaRender] RenderTarget allocator ready");

        initialized = true;
        return true;
    }

    void shutdown() override {
        std::lock_guard<std::mutex> lock(mutex_);
        for (const auto& target : activeTargets_) {
            destroyRenderTarget(target.first);
        }
        activeTargets_.clear();
        status_.clear();
        initialized = false;
    }

    bool createRenderTarget(const std::string& targetId,
                            const RenderTargetConfig& config) override {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!initialized) return false;

        status_.push_back("[VistaRender] Created render target: " + targetId +
                          " (" + std::to_string(config.width) + "x" +
                          std::to_string(config.height) + ")");

        activeTargets_[targetId] = config;
        return true;
    }

    bool destroyRenderTarget(const std::string& targetId) override {
        std::lock_guard<std::mutex> lock(mutex_);
        activeTargets_.erase(targetId);
        status_.push_back("[VistaRender] Destroyed render target: " + targetId);
        return true;
    }

    bool beginCapture(const std::string& targetId,
                     const CameraPose& pose) override {
        std::lock_guard<std::mutex> lock(mutex_);
        if (activeTargets_.find(targetId) == activeTargets_.end()) return false;

        currentPose_ = pose;
        isCapturing_ = true;

        status_.push_back("[VistaRender] Begin capture: " + targetId +
                          " pos=(" + std::to_string((int)pose.x) + "," +
                          std::to_string((int)pose.y) + "," +
                          std::to_string((int)pose.z) + ")");

        return true;
    }

    bool endCapture(const std::string& targetId) override {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!isCapturing_) return false;

        isCapturing_ = false;
        status_.push_back("[VistaRender] End capture: " + targetId);

        return true;
    }

    bool blitToBlock(const std::string& targetId,
                    int64_t blockPosX,
                    int64_t blockPosY,
                    int64_t blockPosZ,
                    const std::string& face) override {
        std::lock_guard<std::mutex> lock(mutex_);
        if (activeTargets_.find(targetId) == activeTargets_.end()) return false;

        status_.push_back("[VistaRender] Blit " + targetId + " to block (" +
                          std::to_string((int)blockPosX) + "," +
                          std::to_string((int)blockPosY) + "," +
                          std::to_string((int)blockPosZ) + ") face=" + face);

        return true;
    }

    bool processCommand(const ModuleCommand& command) override {
        std::lock_guard<std::mutex> lock(mutex_);
        status_.push_back("[VistaRender] Command: " + command.type);

        if (command.type == "capture_start") {
            CameraPose pose{};
            if (command.args.size() >= 6) {
                pose.x = std::stof(command.args[0]);
                pose.y = std::stof(command.args[1]);
                pose.z = std::stof(command.args[2]);
                pose.yaw = std::stof(command.args[3]);
                pose.pitch = std::stof(command.args[4]);
                pose.roll = std::stof(command.args[5]);
            }
            return beginCapture("default", pose);
        }
        if (command.type == "capture_end") {
            return endCapture("default");
        }
        if (command.type == "blit_tv" && command.args.size() >= 4) {
            return blitToBlock("default",
                              std::stoll(command.args[0]),
                              std::stoll(command.args[1]),
                              std::stoll(command.args[2]),
                              command.args[3]);
        }
        return false;
    }

    std::vector<std::string> getStatus() override {
        std::lock_guard<std::mutex> lock(mutex_);
        return status_;
    }

private:
    bool initialized;
    std::mutex mutex_;
    std::vector<std::string> status_;
    std::unordered_map<std::string, RenderTargetConfig> activeTargets_;
    CameraPose currentPose_;
    bool isCapturing_ = false;
};

static RenderModule g_instance;

IRenderModule* createRenderModule() {
    return &g_instance;
}

void destroyRenderModule() {
    g_instance.shutdown();
}

}
