#ifndef VISTA_RENDER_MODULE_H
#define VISTA_RENDER_MODULE_H

#include <cstdint>
#include <string>
#include <vector>

namespace Vista {

struct CameraPose {
    float x;
    float y;
    float z;
    float yaw;
    float pitch;
    float roll;
    int64_t dimensionId;
};

struct RenderTargetConfig {
    uint32_t width;
    uint32_t height;
    bool enableDepth;
    bool enableStencil;
};

struct ModuleCommand {
    std::string type;
    std::vector<std::string> args;
};

class IRenderModule {
public:
    virtual ~IRenderModule() = default;

    virtual bool initialize() = 0;
    virtual void shutdown() = 0;

    virtual bool createRenderTarget(const std::string& targetId,
                                    const RenderTargetConfig& config) = 0;
    virtual bool destroyRenderTarget(const std::string& targetId) = 0;

    virtual bool beginCapture(const std::string& targetId,
                             const CameraPose& pose) = 0;
    virtual bool endCapture(const std::string& targetId) = 0;

    virtual bool blitToBlock(const std::string& targetId,
                            int64_t blockPosX,
                            int64_t blockPosY,
                            int64_t blockPosZ,
                            const std::string& face) = 0;

    virtual bool processCommand(const ModuleCommand& command) = 0;
    virtual std::vector<std::string> getStatus() = 0;
};

IRenderModule* createRenderModule();
void destroyRenderModule();

}

#endif
