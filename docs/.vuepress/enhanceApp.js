import LastReadingPopup from './components/LastReadingPopup.vue'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
let busuanzi;

export default ({
  Vue, // VuePress 正在使用的 Vue 构造函数
  options, // 附加到根实例的一些选项
  router, // 当前应用的路由实例
  siteData, // 站点元数据
  isServer // 当前应用配置是处于 服务端渲染 或 客户端
}) => {
Vue.use(ElementUI)
  /**
   * 百度 pv 统计，不使用的可以去掉或注释掉
   */
  // router.beforeEach((to, from, next) => {
  //   // 路由切换，触发百度的 pv 统计
  //   if (typeof _hmt != "undefined") {
  //     if (to.path) {
  //       _hmt.push(["_trackPageview", to.path]);
  //     }
  //   }
  //   next();
  // })
  /**
   * 私密文章模块
   */
  if (!isServer) {
    router.beforeEach((to, from, next) => {
      siteData.pages.forEach((item) => {
        if (item.path == to.path) {
          if (item.frontmatter.private && item.frontmatter.private == true && siteData.themeConfig.privatePage) {
            let { username, password, loginPath, loginKey, expire, loginSession } = siteData.themeConfig.privatePage;
            if (!expire) {
              expire = 86400000;  // 一天
            }
            if (!loginKey) {
              loginKey = 'softhub_login';
            }
            // 网站关闭或者刷新后，清除登录状态（不针对单个私密文章）
            if (loginSession) {
              window.addEventListener('unload', function () {
                localStorage.removeItem(loginKey);
              });
            }
            // 单个文章私密验证
            if (item.frontmatter.username && item.frontmatter.password) {
              let loginInfo = JSON.parse(localStorage.getItem(item.frontmatter.title));
              if (!loginInfo || (loginInfo.username !== item.frontmatter.username && loginInfo.password !== item.frontmatter.password)) {
                router.push({
                  path: loginPath,
                  query: {
                    toPath: to.path,
                    singlePage: true,    // 代表单个文章
                  }
                });
              }
            }
            // 全局私密验证
            else {
              let loginInfo = JSON.parse(localStorage.getItem(loginKey));
              // 没有登录过
              if (!loginInfo || (loginInfo.username !== username && loginInfo.password !== password)) {
                router.push({
                  path: loginPath,
                  query: {
                    toPath: to.path
                  }
                });
              }
              // 登录状态过期
              else if (new Date() - loginInfo.time > loginInfo.expire) {
                localStorage.removeItem(loginKey);
                router.push({
                  path: loginPath,
                  query: {
                    toPath: to.path
                  }
                });
              }
            }
          }
        }
      });
      next();
    })
  }

  /**
   * 记录最后一次阅读位置模块，方便下次直接跳转
   */
  // 判断是否绑定时间是否绑定成功
  let isMounted = false;
  // 最后一次阅读位置跳转
  Vue.component(LastReadingPopup.name, LastReadingPopup);
  Vue.mixin({
    // 有多少个 Vue 组件（md 文档），就执行多少次 mounted()，所以利用 if 判断只允许执行一次
    mounted() {
      if (!isMounted) { 
        window.addEventListener('unload', this.saveLastReading);  // 卸载窗口前，将数据存储，方便下次可以直接跳转位置
        isMounted = true;
      }
    },
    methods: {
      saveLastReading() {
        localStorage.setItem('lastReading', JSON.stringify({
          path: this.$route.path,
          scrollTop: document.documentElement.scrollTop,
          timestamp: new Date().getTime(),
        }))
      }
    }
  });

  /**
   * 站点和文章页信息模块
   */
  if (!isServer) {
    router.beforeEach((to, from, next) => {
      next();
      if (to.path !== '/' && to.path !== from.path && siteData.themeConfig.blogInfo) {  // 如果页面是非首页，# 号也会触发路由变化，这里已经排除掉
        // 刷新页面或进入新的页面后，如果原来位置的内容还存在，则删除掉，最后重新插入渲染
        removeElement('.page-view-js');
        removeElement('.page-view');
        removeElement('.book-words');
        removeElement('.reading-time');
        siteData.pages.forEach((itemPage) => {
          if (itemPage.path == to.path) {
            if (itemPage.frontmatter.article == undefined || itemPage.frontmatter.article) {  // 排除掉 article 为 false 的文章
              const { eachFileWords, pageView, pageIteration, readingTime } = siteData.themeConfig.blogInfo;
              // 下面两个 if 可以调换位置，从而让文章的浏览量和字数内容交换
              if (eachFileWords) {
                eachFileWords.forEach((itemFile) => {
                  if (itemFile.permalink == itemPage.frontmatter.permalink) {
                    addPageWordsCount(itemFile.wordsCount);
                    if (readingTime || readingTime == undefined) {
                      addReadTimeCount(itemFile.readingTime);
                    }
                  }
                });
              }
              if (pageView || pageView == undefined) {
                addPageView();
                // 挂载成功需要一点时间
                setTimeout(() => {
                  getPageViewCouter(pageIteration);
                }, 1500);
              }

              return;
            }
          }
        })
      }
    })
    // 目前用不到
    router.afterEach((to, from) => {
      if (from.path === '/' && from.matched && from.matched.length === 0) {    // 如果页面是刷新或者第一次进入
      }
    })
  }
}
/**
 * 如果元素存在，则删除
 */
function removeElement(selector) {
  var element = document.querySelector(selector);
  if (element) {
    element.parentNode.removeChild(element);
  }
}

/**
 * 文章页的访问量
 */
function getPageViewCouter(iterationTime = 3000) {
  if (busuanzi) {
    busuanzi.fetch();
  } else {
    busuanzi = require("busuanzi.pure.js");
  }
  var i = 0;
  var defaultCouter = '9999';
  // 如果 require 没有获取成功，则手动获取
  // 但是容易产生访问量叠加，如果只需要第一次获取数据（可能获取失败），可注释掉，此内容是第一次获取失败后，重新获取访问量，可能导致访问量再次 + 1
  // 取决于访问人的网络，以及 setTimeout 的时间（需求调节）
  setTimeout(() => {
    let interval = setInterval(() => {
      const pageView = document.querySelector('.view-data');
      if (pageView) {
        i += iterationTime;
        if (i > iterationTime * 10) {
          pageView.innerText = defaultCouter;
          clearInterval(interval);  // 10 秒后无法获取，则取消获取
        }
        if (pageView.innerText == "") {
          // 手动获取访问量
          busuanzi.fetch();
        } else {
          clearInterval(interval);
        }
      } else {
        clearInterval(interval);
      }
    }, iterationTime);
  }, iterationTime);
}
/**
 * 添加浏览量元素
 */
function addPageView() {
  // 创建访问量的元素
  let template = document.createElement('div');
  template.title = '浏览量';
  template.className = 'page-view iconfont icon-view';
  template.style.float = 'left';
  template.style.marginLeft = '20px';
  template.style.fontSize = '0.8rem';
  // template.innerHTML = '<span id="busuanzi_container_page_pv" style="display: none; margin-left: 3px"><a style="color: #888" href="javascript:;" id="busuanzi_value_page_pv" class="view-data"></a></span>';
  template.innerHTML = '<a style="color: #888; margin-left: 3px" href="javascript:;" id="busuanzi_value_page_pv" class="view-data"><i title="正在获取..." class="loading iconfont icon-loading"></i></a>';
  mountedView(template);
  // 添加 loading 效果
  let style = document.createElement("style");
  style.innerHTML = `@keyframes turn {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  .loading {
    display: inline-block;
    animation: turn 1s linear infinite;
    -webkit-animation: turn 1s linear infinite;
  }`;
  document.head.appendChild(style);
}
/**
 * 添加当前文章页的字数元素
 */
function addPageWordsCount(wordsCount) {
  if (wordsCount) {
    let template = document.createElement('div');
    template.title = '文章字数';
    template.className = 'book-words iconfont icon-book';
    template.style.float = 'left';
    template.style.marginLeft = '20px';
    template.style.fontSize = '0.8rem';

    template.innerHTML = `<a href="javascript:;" style="margin-left: 3px; color: #888">${wordsCount}</a>`;
    mountedView(template);
  }
}

/**
 * 添加预计的阅读时间
 */
function addReadTimeCount(readTimeCount) {
  let template = document.createElement('div');
  template.title = '预阅读时长';
  template.className = 'reading-time iconfont icon-shijian';
  template.style.float = 'left';
  template.style.marginLeft = '20px';
  template.style.fontSize = '0.8rem';
  template.innerHTML = `<a href="javascript:;" style="margin-left: 3px; color: #888">${readTimeCount}</a>`;
  mountedView(template);
}

/**
 * 挂载目标到页面上
 */
function mountedView(template, moutedParentEvent = '.articleInfo-wrap > .articleInfo > .info') {
  var i = 0;
  let interval = setInterval(() => {
    i++;
    const parentElement = document.querySelector(moutedParentEvent);
    if (parentElement) {
      if (!isMountedView(template, parentElement)) {
        parentElement.appendChild(template);
        clearInterval(interval);
      }
    } else if (i > 1 * 10) {  // 10 秒后清除
      clearInterval(interval);
    }
  }, 1000);
}
/**
 * 目标是否已经挂载在页面上
 */
function isMountedView(element, parentElement) {
  if (element.parentNode == parentElement) {
    return true;
  } else {
    return false;
  }
}
